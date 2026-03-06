/**
 * weather-client.js - 天気予報データ取得（Open-Meteo API）
 * APIキー不要・無料・最大7日先予報
 * ドキュメント: https://open-meteo.com/en/docs
 */

class WeatherClient {
  constructor() {
    this.lat = CONFIG.defaultFacility.lat;
    this.lng = CONFIG.defaultFacility.lng;
    this._forecast = null;
    this._lastFetched = 0;
    this._fetchPromise = null;
    this._sunsetByDate = {}; // { 'YYYY-MM-DD': timestamp } 日没時刻キャッシュ

    // WMOコード → 日本語説明マッピング
    this.wmoDescriptions = {
      0:  { desc: '快晴', icon: '☀️', category: 'clear' },
      1:  { desc: '晴れ', icon: '🌤', category: 'clear' },
      2:  { desc: '曇り時々晴れ', icon: '⛅', category: 'cloudy' },
      3:  { desc: '曇り', icon: '☁️', category: 'cloudy' },
      45: { desc: '霧', icon: '🌫', category: 'cloudy' },
      48: { desc: '霧氷', icon: '🌫', category: 'cloudy' },
      51: { desc: '小雨', icon: '🌦', category: 'drizzle' },
      53: { desc: '雨', icon: '🌧', category: 'rainy' },
      55: { desc: '強い雨', icon: '🌧', category: 'rainy' },
      61: { desc: '小雨', icon: '🌦', category: 'drizzle' },
      63: { desc: '雨', icon: '🌧', category: 'rainy' },
      65: { desc: '大雨', icon: '🌧', category: 'heavy_rain' },
      71: { desc: '小雪', icon: '🌨', category: 'snow' },
      73: { desc: '雪', icon: '❄️', category: 'snow' },
      75: { desc: '大雪', icon: '❄️', category: 'snow' },
      80: { desc: 'にわか雨', icon: '🌦', category: 'rainy' },
      81: { desc: 'にわか雨', icon: '🌧', category: 'rainy' },
      82: { desc: '激しいにわか雨', icon: '⛈', category: 'heavy_rain' },
      95: { desc: '雷雨', icon: '⛈', category: 'heavy_rain' },
      96: { desc: '雷雨（雹あり）', icon: '⛈', category: 'heavy_rain' },
      99: { desc: '激しい雷雨', icon: '⛈', category: 'heavy_rain' },
    };
  }

  init(lat, lng) {
    this.lat = lat;
    this.lng = lng;
    this._forecast = null;
    this._lastFetched = 0;
    this._sunsetByDate = {};
  }

  /**
   * 天気予報を取得（キャッシュあり）
   */
  async fetchForecast() {
    const now = Date.now();
    const cacheAge = now - this._lastFetched;

    // キャッシュが有効な場合はそのまま返す
    if (this._forecast && cacheAge < CONFIG.weather.updateIntervalMs) {
      return this._forecast;
    }

    // 同時リクエストを防ぐ
    if (this._fetchPromise) return this._fetchPromise;

    this._fetchPromise = this._doFetch();
    try {
      this._forecast = await this._fetchPromise;
      this._lastFetched = now;
      return this._forecast;
    } finally {
      this._fetchPromise = null;
    }
  }

  async _doFetch() {
    const url = `${CONFIG.weather.apiBase}/forecast?` + new URLSearchParams({
      latitude:  this.lat.toFixed(4),
      longitude: this.lng.toFixed(4),
      hourly:    'temperature_2m,weathercode,precipitation,relativehumidity_2m',
      daily:     'sunset',   // ← 日没時刻を daily パラメータで取得
      timezone:  'Asia/Tokyo',
      forecast_days: CONFIG.weather.forecastDays
    });

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.daily?.sunset) this._parseSunsets(data.daily);
      return this._parseForecast(data);
    } catch (e) {
      console.warn('[WeatherClient] API取得失敗、モックデータを使用:', e.message);
      return this._getMockForecast();
    }
  }

  _parseForecast(data) {
    const hourly = data.hourly;
    const result = {};
    for (let i = 0; i < hourly.time.length; i++) {
      // "2024-01-15T12:00" → Timestamp
      const ts = new Date(hourly.time[i]).getTime();
      result[ts] = {
        timestamp: ts,
        temperature: hourly.temperature_2m[i],
        weatherCode: hourly.weathercode[i],
        precipitation: hourly.precipitation[i],
        humidity: hourly.relativehumidity_2m ? hourly.relativehumidity_2m[i] : 60,
        ...this._getWmoInfo(hourly.weathercode[i])
      };
    }
    console.log(`[WeatherClient] ${Object.keys(result).length}時間分の予報を取得`);
    return result;
  }

  _getWmoInfo(code) {
    const info = this.wmoDescriptions[code] || { desc: '不明', icon: '🌡', category: 'cloudy' };
    return { description: info.desc, icon: info.icon, category: info.category };
  }

  /**
   * 特定日時の天気予報を取得（最も近い1時間データを返す）
   */
  getForecastForDateTime(datetime) {
    if (!this._forecast) return this._getDefaultForecast();

    const target = new Date(datetime);
    // 同じ年月日時で検索
    target.setMinutes(0, 0, 0);
    const targetTs = target.getTime();

    if (this._forecast[targetTs]) return this._forecast[targetTs];

    // 最も近いデータを返す
    const keys = Object.keys(this._forecast).map(Number);
    let nearest = keys[0];
    let minDiff = Math.abs(nearest - targetTs);
    for (const k of keys) {
      const diff = Math.abs(k - targetTs);
      if (diff < minDiff) {
        minDiff = diff;
        nearest = k;
      }
    }
    return this._forecast[nearest] || this._getDefaultForecast();
  }

  /**
   * 天気カテゴリ・気温からゾーン混雑への影響係数を算出
   * @param {Object} weather - { category, temperature }
   * @param {boolean} isIndoor - 屋内ゾーンか
   */
  getWeatherModifier(weather, isIndoor = true) {
    const { category, temperature } = weather;
    let modifier = 1.0;

    if (isIndoor) {
      // 屋内ゾーン：雨天・酷暑・寒波は避難先として人が集まる
      switch (category) {
        case 'heavy_rain': modifier *= 1.20; break;
        case 'rainy':      modifier *= 1.15; break;
        case 'drizzle':    modifier *= 1.10; break;
        case 'snow':       modifier *= 1.18; break;
        case 'clear':      modifier *= 0.92; break; // 天気が良いと外出先分散
        default:           modifier *= 1.00;
      }
      if (temperature > 35) modifier *= 1.12; // 猛暑→冷房求める
      if (temperature < 0)  modifier *= 1.10; // 厳寒→暖を求める
    } else {
      // 屋外ゾーン（入口等）：雨天は激減、快晴は増加
      switch (category) {
        case 'heavy_rain': modifier *= 0.52; break;
        case 'rainy':      modifier *= 0.70; break;
        case 'drizzle':    modifier *= 0.85; break;
        case 'snow':       modifier *= 0.55; break;
        case 'clear':      modifier *= 1.15; break;
        default:           modifier *= 1.00;
      }
      if (temperature > 38) modifier *= 0.80; // 猛暑→外出控える
      if (temperature < -5) modifier *= 0.75; // 厳寒→外出控える
    }

    return Math.max(0.3, Math.min(1.8, modifier));
  }

  /**
   * 今日の天気予報（時間帯別）を取得
   */
  getTodayHourlyForecast() {
    if (!this._forecast) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    return Object.values(this._forecast)
      .filter(f => f.timestamp >= today.getTime() && f.timestamp < tomorrow.getTime())
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * 次の7日間の天気サマリー
   */
  getDailyForecastSummary() {
    if (!this._forecast) return [];

    const dailyMap = {};
    for (const f of Object.values(this._forecast)) {
      const d = new Date(f.timestamp);
      const dateKey = d.toISOString().split('T')[0];
      if (!dailyMap[dateKey]) {
        dailyMap[dateKey] = { date: dateKey, temps: [], codes: [], precipitation: 0 };
      }
      dailyMap[dateKey].temps.push(f.temperature);
      dailyMap[dateKey].codes.push(f.weatherCode);
      dailyMap[dateKey].precipitation += f.precipitation || 0;
    }

    return Object.entries(dailyMap).map(([date, d]) => {
      const maxTemp = Math.max(...d.temps);
      const minTemp = Math.min(...d.temps);
      // 最頻出の天気コードを代表値に
      const dominantCode = this._mode(d.codes);
      const info = this._getWmoInfo(dominantCode);
      return {
        date,
        maxTemp: Math.round(maxTemp),
        minTemp: Math.round(minTemp),
        icon: info.icon,
        description: info.description,
        category: info.category,
        precipitation: Math.round(d.precipitation),
        weatherCode: dominantCode
      };
    }).slice(0, 7);
  }

  _mode(arr) {
    const freq = {};
    for (const v of arr) freq[v] = (freq[v] || 0) + 1;
    return parseInt(Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0]);
  }

  _getDefaultForecast() {
    return { temperature: 18, weatherCode: 2, precipitation: 0, humidity: 60, description: '曇り', icon: '⛅', category: 'cloudy' };
  }

  _getMockForecast() {
    const forecast = {};
    const now = new Date();
    now.setMinutes(0, 0, 0);
    const weatherSequence = [
      { code: 0, temp: 18 }, { code: 1, temp: 20 }, { code: 3, temp: 15 },
      { code: 63, temp: 12 }, { code: 63, temp: 11 }, { code: 2, temp: 14 },
      { code: 0, temp: 19 }
    ];
    for (let day = 0; day < 7; day++) {
      const w = weatherSequence[day % weatherSequence.length];
      for (let h = 0; h < 24; h++) {
        const ts = now.getTime() + (day * 24 + h) * 60 * 60 * 1000;
        const info = this._getWmoInfo(w.code);
        forecast[ts] = {
          timestamp: ts,
          temperature: w.temp + Math.sin(h / 24 * Math.PI) * 5,
          weatherCode: w.code,
          precipitation: [63, 65, 80, 81, 82].includes(w.code) ? Math.random() * 5 : 0,
          humidity: 60,
          ...info
        };
      }
    }
    return forecast;
  }

  // ----------------------------------------------------------------
  // 日没時刻（Sunset）
  // ----------------------------------------------------------------

  /** Open-Meteo daily.sunset 配列をパースして日付→タイムスタンプに変換 */
  _parseSunsets(daily) {
    const { time: dates, sunset: sunsets } = daily;
    if (!dates || !sunsets) return;
    for (let i = 0; i < dates.length; i++) {
      const ts = new Date(sunsets[i]).getTime();
      if (!isNaN(ts)) this._sunsetByDate[dates[i]] = ts;
    }
    console.log(`[WeatherClient] 日没時刻: ${Object.keys(this._sunsetByDate).length}日分を取得`);
  }

  /**
   * 指定日の日没タイムスタンプを返す（取得失敗時は近似値）
   * @param {Date|number|string} date
   * @returns {number} UTC milliseconds
   */
  getSunsetForDate(date) {
    const d   = new Date(date);
    const key = d.toISOString().split('T')[0];
    if (this._sunsetByDate[key]) return this._sunsetByDate[key];

    // フォールバック: 東京の季節別近似日没時刻
    const month = d.getMonth() + 1;
    const approxHours = [17.0, 17.5, 18.0, 18.5, 19.0, 19.3, 19.2, 18.8,
                          18.0, 17.3, 16.7, 16.5][month - 1];
    const fallback = new Date(d);
    fallback.setHours(Math.floor(approxHours), Math.round((approxHours % 1) * 60), 0, 0);
    return fallback.getTime();
  }

  /**
   * 対象時刻が「日没前後windowMs以内」かどうかを返す
   * シナリオ3（夕方需要シフト）のトリガー判定に使用
   * @param {number} targetTs - チェックしたい時刻（ms）
   * @param {number} windowMs - 前後の余裕幅（デフォルト30分）
   * @returns {{ isNearSunset: boolean, minutesFromSunset: number, sunsetTs: number }}
   */
  isNearSunset(targetTs, windowMs = 30 * 60 * 1000) {
    const sunsetTs = this.getSunsetForDate(new Date(targetTs));
    const diff     = targetTs - sunsetTs; // 正=日没後, 負=日没前
    return {
      isNearSunset:     Math.abs(diff) <= windowMs,
      minutesFromSunset: Math.round(diff / 60000),
      sunsetTs
    };
  }

  /**
   * 今日の日没時刻を "HH:MM" 形式で返す（UI表示用）
   */
  getSunsetTimeString() {
    const ts = this.getSunsetForDate(new Date());
    return new Date(ts).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  }

  isDataAvailable() {
    return this._forecast !== null;
  }
}

window.weatherClient = new WeatherClient();
