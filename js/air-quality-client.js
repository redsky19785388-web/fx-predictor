/**
 * air-quality-client.js - 大気質・花粉データ取得（Open-Meteo Air Quality API）
 * APIキー不要・無料
 * エンドポイント: https://air-quality-api.open-meteo.com/v1/air-quality
 *
 * 取得変数:
 *   pm2_5          : PM2.5濃度 (μg/m³)
 *   birch_pollen   : シラカバ花粉 (grains/m³)
 *   alder_pollen   : ハンノキ花粉 (grains/m³)
 *   grass_pollen   : イネ科花粉 (grains/m³)
 *
 * ※スギ・ヒノキ花粉はOpen-Meteoに未実装のため、
 *   春季（2〜5月）のbirch+alder+grassを「花粉総量」として近似する
 */

class AirQualityClient {
  constructor() {
    this.lat = CONFIG.defaultFacility.lat;
    this.lng = CONFIG.defaultFacility.lng;
    this._cache       = null;
    this._lastFetched = 0;
    this._fetchPromise = null;
    this._cacheMs     = 30 * 60 * 1000; // 30分キャッシュ
  }

  init(lat, lng) {
    this.lat = lat;
    this.lng = lng;
    this._cache = null;
    this._lastFetched = 0;
  }

  // ----------------------------------------------------------------
  // フェッチ（キャッシュあり）
  // ----------------------------------------------------------------

  async fetchAirQuality() {
    if (this._cache && Date.now() - this._lastFetched < this._cacheMs) {
      return this._cache;
    }
    if (this._fetchPromise) return this._fetchPromise;

    this._fetchPromise = this._doFetch();
    try {
      this._cache = await this._fetchPromise;
      this._lastFetched = Date.now();
      return this._cache;
    } finally {
      this._fetchPromise = null;
    }
  }

  async _doFetch() {
    const url = 'https://air-quality-api.open-meteo.com/v1/air-quality?' +
      new URLSearchParams({
        latitude:  this.lat.toFixed(4),
        longitude: this.lng.toFixed(4),
        hourly:    'pm2_5,birch_pollen,alder_pollen,grass_pollen',
        timezone:  'Asia/Tokyo',
        forecast_days: 3
      });

    try {
      const controller = new AbortController();
      const timeoutId  = setTimeout(() => controller.abort(), 8000);
      const res  = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      console.log('[AirQualityClient] 大気質データ取得成功');
      return this._parse(data);
    } catch (e) {
      console.warn('[AirQualityClient] API取得失敗 → フォールバック:', e.message);
      return this._getMockData();
    }
  }

  _parse(data) {
    const h = data.hourly;
    const result = {};
    for (let i = 0; i < h.time.length; i++) {
      const ts = new Date(h.time[i]).getTime();
      const pm25   = h.pm2_5?.[i]          ?? 0;
      const birch  = h.birch_pollen?.[i]    ?? 0;
      const alder  = h.alder_pollen?.[i]    ?? 0;
      const grass  = h.grass_pollen?.[i]    ?? 0;
      const totalPollen = birch + alder + grass;
      result[ts] = { ts, pm25, birch, alder, grass, totalPollen };
    }
    return result;
  }

  _getMockData() {
    // 季節に応じた現実的なモック値（東京・春）
    const month = new Date().getMonth() + 1;
    const mockResult = {};
    const now = new Date(); now.setMinutes(0, 0, 0);
    // 春（2-5月）: 花粉多い / 夏秋: 少ない
    const isSpring = month >= 2 && month <= 5;
    const basePollen = isSpring ? 80 : 5;
    const basePm25   = isSpring ? 18 : 10;

    for (let h = 0; h < 72; h++) {
      const ts = now.getTime() + h * 3600000;
      const daytimeBoost = (h % 24 >= 10 && h % 24 <= 17) ? 1.5 : 0.7;
      const totalPollen = Math.max(0, basePollen * daytimeBoost + (Math.random() - 0.5) * 20);
      mockResult[ts] = {
        ts, pm25: basePm25 * daytimeBoost, birch: totalPollen * 0.6,
        alder: totalPollen * 0.25, grass: totalPollen * 0.15, totalPollen
      };
    }
    return mockResult;
  }

  // ----------------------------------------------------------------
  // データ取得
  // ----------------------------------------------------------------

  /** 特定時刻の大気質データを返す（最近傍1時間） */
  getForDateTime(datetime) {
    if (!this._cache) return this._getDefaultData();
    const target = new Date(datetime);
    target.setMinutes(0, 0, 0);
    const ts = target.getTime();
    if (this._cache[ts]) return this._cache[ts];

    // 最近傍
    const keys = Object.keys(this._cache).map(Number);
    const nearest = keys.reduce((best, k) =>
      Math.abs(k - ts) < Math.abs(best - ts) ? k : best, keys[0]);
    return this._cache[nearest] || this._getDefaultData();
  }

  _getDefaultData() {
    const month = new Date().getMonth() + 1;
    const isSpring = month >= 2 && month <= 5;
    return { ts: 0, pm25: isSpring ? 18 : 8, birch: isSpring ? 60 : 3,
             alder: isSpring ? 20 : 1, grass: isSpring ? 10 : 1,
             totalPollen: isSpring ? 90 : 5 };
  }

  // ----------------------------------------------------------------
  // レベル判定
  // ----------------------------------------------------------------

  /**
   * 花粉総量レベルを返す
   * @param {number} totalPollen - grains/m³
   * @returns {'none'|'low'|'moderate'|'high'|'very_high'}
   */
  static getPollenLevel(totalPollen) {
    if (totalPollen < 5)   return 'none';
    if (totalPollen < 30)  return 'low';
    if (totalPollen < 80)  return 'moderate';
    if (totalPollen < 200) return 'high';
    return 'very_high';
  }

  /**
   * PM2.5レベルを返す
   * @param {number} pm25 - μg/m³
   * @returns {'good'|'moderate'|'unhealthy'|'hazardous'}
   */
  static getPm25Level(pm25) {
    if (pm25 < 12)  return 'good';
    if (pm25 < 35)  return 'moderate';
    if (pm25 < 75)  return 'unhealthy';
    return 'hazardous';
  }

  /**
   * 総合大気質スコアを返す（花粉 + PM2.5の複合評価）
   * @param {Object} data - { totalPollen, pm25 }
   * @returns {{ level: string, label: string, icon: string, pollenLevel: string, pm25Level: string }}
   */
  static getCompositeLevel(data) {
    const pollenLevel = AirQualityClient.getPollenLevel(data.totalPollen);
    const pm25Level   = AirQualityClient.getPm25Level(data.pm25);

    const RANK = { none: 0, low: 1, good: 0, moderate: 2, high: 3, unhealthy: 4, very_high: 4, hazardous: 5 };
    const rank = Math.max(RANK[pollenLevel] || 0, RANK[pm25Level] || 0);

    const LEVELS = [
      { level: 'good',       label: '良好',     icon: '😊' },
      { level: 'low',        label: '少ない',   icon: '🌿' },
      { level: 'moderate',   label: 'やや多い', icon: '😶' },
      { level: 'high',       label: '多い',     icon: '😷' },
      { level: 'very_high',  label: '非常に多い', icon: '🚫' },
      { level: 'hazardous',  label: '危険',     icon: '⚠️' },
    ];
    return { ...LEVELS[Math.min(rank, LEVELS.length - 1)], pollenLevel, pm25Level };
  }

  /**
   * 大気質による混雑モディファイアを返す（予測エンジン向け）
   * シナリオ1: 晴れ + 高花粉/PM2.5 → 屋外ゾーン下方修正 / 屋内ゾーン上方修正
   *
   * @param {Object} zone         - ゾーン定義 { type, isIndoor }
   * @param {Object} aqData       - { totalPollen, pm25 }
   * @param {string} weatherCategory - 'clear'|'cloudy'|'rainy'|...
   * @returns {{ modifier: number, scenario: string|null }}
   */
  static getAirQualityModifier(zone, aqData, weatherCategory) {
    const pollenLevel = AirQualityClient.getPollenLevel(aqData.totalPollen);
    const pm25Level   = AirQualityClient.getPm25Level(aqData.pm25);
    const isBadAir    = pollenLevel === 'high' || pollenLevel === 'very_high' ||
                        pm25Level   === 'unhealthy' || pm25Level === 'hazardous';
    const isClearDay  = weatherCategory === 'clear';

    // シナリオ1: 晴れ + 高花粉/PM2.5
    if (isBadAir && isClearDay) {
      if (zone.isIndoor) {
        // 屋内カフェ・美術館などに花粉回避者が集中
        const indoorBoosts = { cafe: 1.38, museum: 1.30, market: 1.25, leisure: 1.20 };
        const boost = indoorBoosts[zone.type] || 1.15;
        return { modifier: boost, scenario: 'pollen_indoor_refuge' };
      } else {
        // 屋外ゾーンは花粉を嫌がる人が減少
        const outdoorCuts = { park: 0.68, shrine: 0.75, leisure: 0.72 };
        const cut = outdoorCuts[zone.type] || 0.80;
        return { modifier: cut, scenario: 'pollen_outdoor_avoidance' };
      }
    }

    // やや悪い場合（moderate花粉）: 軽微な影響
    if (pollenLevel === 'moderate' && isClearDay) {
      if (zone.isIndoor)  return { modifier: 1.10, scenario: 'pollen_mild_indoor' };
      if (!zone.isIndoor) return { modifier: 0.90, scenario: 'pollen_mild_outdoor' };
    }

    return { modifier: 1.0, scenario: null };
  }

  isDataAvailable() { return this._cache !== null; }
}

window.airQualityClient = new AirQualityClient();
