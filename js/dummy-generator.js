/**
 * dummy-generator.js - テスト用ダミー混雑データ生成
 * 施設タイプ・時間帯・イベント・天気効果を模倣したリアルなデータを生成
 */

class DummyGenerator {
  constructor() {
    // 施設タイプ別の基本混雑パターン（時間帯 0-23 → 基本混雑度 0-100）
    this.facilityPatterns = {
      mall: {
        weekday: [2, 2, 2, 2, 2, 2, 2, 2, 5, 25, 45, 65, 70, 55, 60, 65, 70, 75, 70, 55, 40, 20, 8, 3],
        weekend: [2, 2, 2, 2, 2, 2, 3, 5, 15, 40, 65, 80, 85, 80, 80, 85, 85, 80, 75, 65, 50, 30, 15, 5],
        holiday: [2, 2, 2, 2, 2, 2, 3, 5, 20, 50, 75, 88, 92, 88, 85, 88, 88, 85, 80, 70, 55, 35, 18, 5]
      },
      supermarket: {
        weekday: [2, 2, 2, 2, 2, 2, 2, 5, 20, 35, 55, 70, 65, 50, 55, 65, 70, 80, 85, 75, 60, 40, 20, 5],
        weekend: [2, 2, 2, 2, 2, 2, 2, 8, 30, 55, 70, 80, 85, 80, 80, 85, 88, 90, 85, 75, 60, 45, 25, 8],
        holiday: [2, 2, 2, 2, 2, 2, 2, 8, 35, 60, 75, 85, 88, 85, 82, 87, 88, 88, 85, 78, 62, 47, 27, 8]
      },
      station: {
        weekday: [2, 2, 2, 3, 5, 25, 70, 90, 85, 55, 45, 60, 75, 55, 45, 50, 60, 80, 88, 75, 55, 35, 20, 8],
        weekend: [2, 2, 2, 2, 3, 8, 20, 40, 55, 65, 72, 78, 80, 78, 75, 77, 80, 78, 72, 65, 50, 35, 20, 8],
        holiday: [2, 2, 2, 2, 3, 8, 20, 42, 58, 68, 75, 82, 85, 82, 78, 80, 83, 80, 75, 68, 52, 37, 22, 8]
      }
    };

    // ゾーンタイプ別係数
    this.zoneCoefficients = {
      entrance:   [0.9, 0.9, 0.9, 0.85, 0.85, 1.15, 1.2, 1.2, 1.1, 1.0, 1.0, 1.0],
      food_court: [0.4, 0.4, 0.4, 0.4,  0.4,  0.4,  0.5, 0.5, 0.6, 0.8, 1.3, 2.0, 2.0, 1.5, 0.9, 0.9, 1.0, 1.4, 1.5, 1.3, 1.1, 0.8, 0.5, 0.4],
      checkout:   [0.3, 0.3, 0.3, 0.3,  0.3,  0.3,  0.4, 0.5, 0.8, 1.0, 1.0, 1.0, 0.9, 0.9, 0.9, 1.0, 1.0, 1.1, 1.5, 1.6, 1.5, 1.2, 0.7, 0.3],
      retail:     [0.3, 0.3, 0.3, 0.3,  0.3,  0.3,  0.3, 0.4, 0.7, 1.0, 1.1, 1.0, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.3, 1.1, 0.9, 0.5, 0.3],
      service:    [0.2, 0.2, 0.2, 0.2,  0.2,  0.2,  0.3, 0.5, 1.0, 1.2, 1.1, 0.9, 0.7, 0.8, 1.1, 1.2, 1.0, 0.9, 0.8, 0.7, 0.5, 0.3, 0.2, 0.2],
      rest:       [0.2, 0.2, 0.2, 0.2,  0.2,  0.2,  0.2, 0.3, 0.5, 0.7, 0.8, 1.2, 1.5, 1.3, 1.0, 1.0, 1.1, 1.0, 0.9, 0.7, 0.5, 0.3, 0.2, 0.2],
    };

    // 日本の祝日リスト（2025-2026）
    this.holidays = new Set([
      '2025-01-01', '2025-01-13', '2025-02-11', '2025-02-23',
      '2025-03-20', '2025-04-29', '2025-05-03', '2025-05-04',
      '2025-05-05', '2025-07-21', '2025-08-11', '2025-09-15',
      '2025-09-23', '2025-10-13', '2025-11-03', '2025-11-23',
      '2025-12-23', '2026-01-01', '2026-01-12', '2026-02-11',
      '2026-02-23', '2026-03-20', '2026-04-29', '2026-05-03',
      '2026-05-04', '2026-05-05',
    ]);
  }

  /**
   * ダミーデータを生成してDataManagerに保存
   * @param {string} facilityType - 'mall' | 'supermarket' | 'station'
   * @param {number} days - 生成する日数
   * @param {Object} options - { includeEvents, includeWeather, includeHolidays }
   * @param {Array} zones - 対象ゾーン配列
   */
  generate(facilityType = 'mall', days = 30, options = {}, zones = []) {
    const {
      includeEvents = true,
      includeWeather = true,
      includeHolidays = true
    } = options;

    const patterns = this.facilityPatterns[facilityType] || this.facilityPatterns.mall;
    const records = [];
    const now = Date.now();
    const startTime = now - days * 24 * 60 * 60 * 1000;

    // 天気シードを生成（3〜5日ごとに天気パターンが変わる）
    const weatherPatterns = this._generateWeatherPattern(days);
    // イベントを生成（期間中に数回）
    const events = includeEvents ? this._generateRandomEvents(days, startTime) : [];

    for (let dayOffset = 0; dayOffset < days; dayOffset++) {
      const dayStart = startTime + dayOffset * 24 * 60 * 60 * 1000;
      const dayDate = new Date(dayStart);
      const dateStr = dayDate.toISOString().split('T')[0];
      const dow = dayDate.getDay();
      const isWeekend = dow === 0 || dow === 6;
      const isHoliday = includeHolidays && this.holidays.has(dateStr);

      // 当日の基本パターンを決定
      let basePattern;
      if (isHoliday) {
        basePattern = patterns.holiday;
      } else if (isWeekend) {
        basePattern = patterns.weekend;
      } else {
        basePattern = patterns.weekday;
      }

      // 天気モディファイア（その日の天気）
      const weatherMod = includeWeather ? weatherPatterns[dayOffset] : { indoor: 1.0, outdoor: 1.0 };
      // イベントモディファイア（その日のイベント）
      const eventMod = this._getEventModifier(dayStart, events);

      // 1時間ごとにデータを生成
      for (let hour = 0; hour < 24; hour++) {
        const timestamp = dayStart + hour * 60 * 60 * 1000 + Math.floor(Math.random() * 30) * 60 * 1000;

        for (const zone of zones) {
          const zoneCoeff = this._getZoneCoefficient(zone.type, hour);
          const isIndoor = zone.isIndoor !== false;

          let baseCrowding = basePattern[hour] * zoneCoeff;
          // 天気効果
          const wm = isIndoor ? weatherMod.indoor : weatherMod.outdoor;
          baseCrowding *= wm;
          // イベント効果
          baseCrowding *= eventMod;

          // ランダムノイズ（±15%）
          const noise = 0.85 + Math.random() * 0.30;
          let crowdingLevel = baseCrowding * noise;
          crowdingLevel = Math.max(0, Math.min(100, crowdingLevel));

          // 閉店時間外は0
          const facilityOpen = CONFIG.defaultFacility.openHour || 9;
          const facilityClose = CONFIG.defaultFacility.closeHour || 22;
          if (hour < facilityOpen || hour >= facilityClose) {
            crowdingLevel = Math.random() * 3; // ほぼ0
          }

          const visitorCount = Math.round((zone.capacity || 100) * crowdingLevel / 100);

          records.push({
            zoneId: zone.id,
            timestamp,
            crowdingLevel: Math.round(crowdingLevel),
            visitorCount
          });
        }
      }
    }

    const count = dataManager.saveBulkRecords(records);
    console.log(`[DummyGenerator] ${count}件のダミーデータを生成しました`);
    return count;
  }

  /**
   * 天気パターンを生成（3〜5日周期でランダム）
   */
  _generateWeatherPattern(days) {
    const patterns = [];
    let currentWeather = this._randomWeatherMod();
    let daysInPattern = Math.floor(Math.random() * 3) + 2; // 2〜4日

    for (let i = 0; i < days; i++) {
      if (daysInPattern <= 0) {
        currentWeather = this._randomWeatherMod();
        daysInPattern = Math.floor(Math.random() * 3) + 2;
      }
      patterns.push({ ...currentWeather });
      daysInPattern--;
    }
    return patterns;
  }

  /**
   * ランダムな天気モディファイアを生成
   */
  _randomWeatherMod() {
    const weatherTypes = [
      { name: 'clear', indoor: 0.90, outdoor: 1.15 },    // 晴れ：屋外人気↑
      { name: 'cloudy', indoor: 1.00, outdoor: 1.00 },   // 曇り：影響なし
      { name: 'rainy', indoor: 1.15, outdoor: 0.72 },    // 雨：屋内↑/屋外↓
      { name: 'heavy_rain', indoor: 1.20, outdoor: 0.55 }, // 大雨
      { name: 'snow', indoor: 1.18, outdoor: 0.50 },     // 雪
      { name: 'hot', indoor: 1.10, outdoor: 0.85 },      // 猛暑：冷房求め屋内↑
      { name: 'cold', indoor: 1.08, outdoor: 0.80 },     // 寒波
    ];
    // 晴れ・曇りが多くなるよう重み付け
    const weights = [35, 30, 15, 5, 3, 7, 5];
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < weatherTypes.length; i++) {
      r -= weights[i];
      if (r <= 0) return weatherTypes[i];
    }
    return weatherTypes[0];
  }

  /**
   * ランダムなイベントリストを生成
   */
  _generateRandomEvents(days, startTime) {
    const events = [];
    const eventCount = Math.floor(days / 7) + Math.floor(Math.random() * 3); // 週1〜2回

    for (let i = 0; i < eventCount; i++) {
      const dayOffset = Math.floor(Math.random() * days);
      const eventStart = startTime + dayOffset * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000; // 10時開始
      const eventDays = Math.random() < 0.3 ? 2 : 1; // 30%の確率で2日間

      events.push({
        name: this._randomEventName(),
        startTime: eventStart,
        endTime: eventStart + eventDays * 24 * 60 * 60 * 1000,
        size: Math.random() < 0.2 ? 'large' : 'medium',
        modifier: Math.random() < 0.2 ? 1.5 : 1.2
      });
    }
    return events;
  }

  _randomEventName() {
    const names = [
      'セール・フェア', '地域文化祭', 'スポーツ大会', 'フリーマーケット',
      'クリスマスフェア', '花火大会', 'アニメコンベンション', '食フェス'
    ];
    return names[Math.floor(Math.random() * names.length)];
  }

  _getEventModifier(timestamp, events) {
    for (const event of events) {
      if (timestamp >= event.startTime && timestamp < event.endTime) {
        return event.modifier;
      }
    }
    return 1.0;
  }

  /**
   * ゾーンタイプ・時間帯別係数を取得
   */
  _getZoneCoefficient(zoneType, hour) {
    const coeffs = this.zoneCoefficients[zoneType];
    if (!coeffs) return 1.0;
    // food_courtなど24時間分の係数がある場合
    if (coeffs.length === 24) return coeffs[hour];
    // 12要素の場合は2時間ブロック
    if (coeffs.length === 12) return coeffs[Math.floor(hour / 2)];
    return 1.0;
  }
}

window.dummyGenerator = new DummyGenerator();
