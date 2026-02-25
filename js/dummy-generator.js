/**
 * dummy-generator.js - 上野公園エリア特化ダミーデータ生成
 * 季節変動（桜シーズン・ぼたん祭・紅葉等）、月曜休館、天気効果を忠実に再現
 */

class DummyGenerator {
  constructor() {
    // 上野公園エリアの時間帯別基本パターン（時間帯 0-23 → 混雑度 0-100）
    // 上野公園は9時〜17時が動物園・美術館のコアタイム、夜も公園として利用
    this.uenoBasePatterns = {
      weekday: [2,2,2,2,2,2,5,10,20,50,65,75,72,65,68,70,68,60,45,30,18,12,8,3],
      weekend: [2,2,2,2,2,2,6,12,30,65,80,88,85,82,82,85,83,75,62,50,35,22,12,4],
      holiday: [2,2,2,2,2,2,7,15,38,72,88,92,90,88,86,90,88,80,68,55,40,25,14,5]
    };

    // ゾーンタイプ別 時間帯係数（24時間分）
    // 上野公園の各ロケーション特性を反映
    this.zoneCoefficients = {
      // カフェ：朝ゆっくり、昼〜夕方ピーク、閉店前高め
      cafe:    [0.1,0.1,0.1,0.1,0.1,0.1,0.2,0.5,0.9,1.0,1.1,1.4,1.5,1.3,1.2,1.2,1.1,1.0,0.9,0.7,0.5,0.4,0.3,0.1],
      // 美術館：開館時間帯のみ（通常9-17時）
      museum:  [0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.1,0.5,1.0,1.2,1.1,1.0,1.1,1.2,1.1,0.8,0.4,0.1,0.0,0.0,0.0,0.0,0.0],
      // 公園・桜並木：昼〜夕方が圧倒的ピーク、天気依存大
      park:    [0.1,0.1,0.1,0.1,0.1,0.2,0.4,0.8,1.1,1.2,1.2,1.3,1.3,1.2,1.2,1.2,1.1,1.0,0.8,0.6,0.4,0.3,0.2,0.1],
      // 観光スポット（東照宮）：午前〜午後中心
      shrine:  [0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.2,0.6,1.1,1.3,1.2,1.0,1.1,1.2,1.1,0.9,0.6,0.3,0.1,0.0,0.0,0.0,0.0],
      // レジャー（ボート）：昼間のみ運行、春〜秋
      leisure: [0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.1,0.3,0.8,1.2,1.4,1.3,1.3,1.3,1.2,1.1,0.8,0.4,0.1,0.0,0.0,0.0,0.0],
      // 商店街（アメ横）：昼〜夜まで営業
      market:  [0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.2,0.5,0.9,1.1,1.2,1.2,1.1,1.1,1.2,1.3,1.4,1.4,1.2,1.0,0.8,0.5,0.2],
    };

    // 月別の季節補正（上野公園特有の年間パターン）
    // index 0=1月, 11=12月
    this.monthMultipliers = {
      // 全体の季節感
      overall: [0.70, 0.75, 1.00, 1.20, 1.00, 0.85, 0.95, 1.00, 0.90, 1.00, 1.05, 0.90],
      // 公園・屋外特化（桜シーズンで急増）
      park:    [0.45, 0.50, 1.20, 2.50, 0.90, 0.70, 0.85, 0.90, 0.80, 1.00, 1.10, 0.65],
      // カフェ（花見客で春激増）
      cafe:    [0.70, 0.75, 1.30, 2.00, 1.10, 0.90, 1.00, 1.05, 0.95, 1.05, 1.10, 1.20],
      // 美術館（展覧会次第だが秋〜冬が人気）
      museum:  [0.85, 0.85, 1.00, 1.10, 1.00, 0.80, 0.85, 0.90, 0.90, 1.10, 1.20, 0.95],
      // ボート（春〜秋のみ運行）
      leisure: [0.00, 0.00, 0.30, 0.80, 1.00, 1.00, 1.10, 1.10, 1.00, 0.80, 0.20, 0.00],
      // 商店街（年末に超混雑）
      market:  [0.75, 0.80, 0.90, 1.00, 1.00, 0.85, 0.90, 0.90, 0.85, 0.90, 0.95, 1.80],
    };

    // 日本の祝日（2025-2026）
    this.holidays = new Set([
      '2025-01-01','2025-01-13','2025-02-11','2025-02-23',
      '2025-03-20','2025-04-29','2025-05-03','2025-05-04',
      '2025-05-05','2025-07-21','2025-08-11','2025-09-15',
      '2025-09-23','2025-10-13','2025-11-03','2025-11-23',
      '2025-12-23','2026-01-01','2026-01-12','2026-02-11',
      '2026-02-23','2026-03-20','2026-04-29','2026-05-03',
      '2026-05-04','2026-05-05',
    ]);
  }

  /**
   * 上野公園特化ダミーデータを生成してDataManagerに保存
   */
  generate(facilityType = 'ueno', days = 30, options = {}, zones = []) {
    const {
      includeEvents = true,
      includeWeather = true,
      includeHolidays = true
    } = options;

    const records = [];
    const now = Date.now();
    const startTime = now - days * 24 * 60 * 60 * 1000;

    // 天気シードを生成
    const weatherPatterns = this._generateWeatherPattern(days, startTime);

    for (let dayOffset = 0; dayOffset < days; dayOffset++) {
      const dayStart = startTime + dayOffset * 24 * 60 * 60 * 1000;
      const dayDate = new Date(dayStart);
      const dateStr = dayDate.toISOString().split('T')[0];
      const dow = dayDate.getDay();
      const month = dayDate.getMonth(); // 0-indexed
      const dayOfMonth = dayDate.getDate();
      const isWeekend = dow === 0 || dow === 6;
      const isHoliday = includeHolidays && this.holidays.has(dateStr);
      const isMonday = dow === 1;

      // 基本パターン選択
      let basePat = isHoliday ? this.uenoBasePatterns.holiday
                  : isWeekend ? this.uenoBasePatterns.weekend
                               : this.uenoBasePatterns.weekday;

      // 天気パターン
      const weather = includeWeather ? weatherPatterns[dayOffset] : { name: 'clear', indoor: 1.0, outdoor: 1.0 };

      // 上野公園特有の特別イベント係数
      const cherryMod = this._getCherryBlossomMod(month, dayOfMonth);

      for (let hour = 0; hour < 24; hour++) {
        const timestamp = dayStart + hour * 60 * 60 * 1000 + Math.floor(Math.random() * 45) * 60 * 1000;

        for (const zone of zones) {
          const zoneType = zone.type;
          const isIndoor = zone.isIndoor !== false;

          // 1. 基本パターン（時間帯）
          let level = basePat[hour];

          // 2. ゾーン係数（時間帯別特性）
          const zoneCoeff = this._getZoneCoeff(zoneType, hour);
          level *= zoneCoeff;

          // 3. 月別季節補正
          const monthMult = this._getMonthMultiplier(zoneType, month);
          level *= monthMult;

          // 4. 天気効果
          const wm = isIndoor ? weather.indoor : weather.outdoor;
          level *= wm;

          // 5. 上野公園特有の補正
          level = this._applyUenoSpecial(level, zone, month, dayOfMonth, dow, isMonday, weather);

          // 6. 桜シーズン補正（公園・カフェに大きく影響）
          if (cherryMod > 1.0) {
            const cherryZoneMult = this._getCherryZoneMult(zoneType, cherryMod);
            level *= cherryZoneMult;
          }

          // 7. ノイズ（±12%）
          level *= 0.88 + Math.random() * 0.24;

          // 施設時間外はほぼゼロ
          if (hour < CONFIG.defaultFacility.openHour || hour >= CONFIG.defaultFacility.closeHour) {
            level = Math.random() * 3;
          }
          // ボートは夏〜春のみ（11〜3月は閉鎖）
          if (zoneType === 'leisure' && (month < 2 || month > 10)) {
            level = Math.random() * 2;
          }

          level = Math.max(0, Math.min(100, Math.round(level)));
          const visitorCount = Math.round((zone.capacity || 100) * level / 100);

          records.push({ zoneId: zone.id, timestamp, crowdingLevel: level, visitorCount });
        }
      }
    }

    const count = dataManager.saveBulkRecords(records);
    console.log(`[DummyGenerator] 上野公園用 ${count}件のデータを生成しました`);
    return count;
  }

  /**
   * 桜シーズン係数（3/20〜4/15が対象）
   */
  _getCherryBlossomMod(month, day) {
    // month: 0-indexed (2=3月, 3=4月)
    if (month === 2 && day >= 28) return 3.5;   // 3月下旬ピーク
    if (month === 3 && day <= 7)  return 3.5;   // 4月上旬ピーク
    if (month === 2 && day >= 20) return 2.0;   // 3月中旬開花
    if (month === 3 && day <= 15) return 1.6;   // 4月中旬散り始め
    return 1.0;
  }

  /**
   * ゾーンタイプ別の桜係数（カフェ・公園が特に大きな恩恵）
   */
  _getCherryZoneMult(zoneType, baseMod) {
    const zoneBoost = {
      park:    baseMod,           // 最大の恩恵（花見エリア本体）
      cafe:    baseMod * 0.70,    // 大幅増（花見客の飲食）
      market:  baseMod * 0.55,    // 中程度（通行客）
      shrine:  baseMod * 0.60,    // 中程度（観光客流入）
      museum:  baseMod * 0.40,    // 小幅（美術館は独立）
      leisure: baseMod * 0.50,    // ボートも桜時期は人気
    };
    return zoneBoost[zoneType] || baseMod * 0.45;
  }

  /**
   * 上野公園特有の各種補正
   */
  _applyUenoSpecial(level, zone, month, day, dow, isMonday, weather) {
    let mod = level;

    // 月曜・美術館・博物館の休館効果
    if (isMonday && zone.closedOnMonday) {
      mod *= CONFIG.museumMondayEffect; // 大幅削減
    }

    // ぼたん祭り（東照宮）春：4/10〜5/10
    if (zone.id === 'zone_toshogu' && month === 3 && day >= 10) mod *= 1.5;
    if (zone.id === 'zone_toshogu' && month === 4 && day <= 10) mod *= 1.5;

    // ぼたん祭り（東照宮）冬：1〜2月
    if (zone.id === 'zone_toshogu' && (month === 0 || (month === 1 && day <= 20))) mod *= 1.3;

    // 蓮の開花（不忍池）7〜8月
    if (zone.id === 'zone_shinobazu_boat' && (month === 6 || month === 7)) mod *= 1.35;

    // 年末アメ横（12/27〜31）
    if (zone.id === 'zone_ameyoko' && month === 11 && day >= 27) mod *= 3.0;
    if (zone.id === 'zone_ameyoko' && month === 11 && day >= 24) mod *= 1.8; // クリスマス前後

    // ゴールデンウィーク（4/29〜5/5）: 全ゾーン高
    if ((month === 3 && day >= 29) || (month === 4 && day <= 5)) mod *= 1.8;

    // 猛暑（7〜8月）の影響: 屋外↓、カフェ・博物館↑（冷房求め）
    if ((month === 6 || month === 7) && !zone.isIndoor) {
      if (weather.name === 'hot') mod *= 0.75;
    }
    if ((month === 6 || month === 7) && zone.isIndoor) {
      if (weather.name === 'hot') mod *= 1.15;
    }

    // 雨天の影響（上野は屋外が多い）
    if (weather.name === 'rainy' && !zone.isIndoor) mod *= 0.60;
    if (weather.name === 'heavy_rain' && !zone.isIndoor) mod *= 0.40;

    // 花見シーズン＋雨は屋外大幅減だがカフェに滑り込む
    const cherryMod = this._getCherryBlossomMod(month, day);
    if (cherryMod > 1.5 && weather.name === 'rainy' && zone.type === 'cafe') mod *= 1.4;

    return mod;
  }

  _getZoneCoeff(zoneType, hour) {
    const c = this.zoneCoefficients[zoneType];
    return c ? c[hour] : 1.0;
  }

  _getMonthMultiplier(zoneType, month) {
    const m = this.monthMultipliers[zoneType] || this.monthMultipliers.overall;
    return m[month] || 1.0;
  }

  _generateWeatherPattern(days, startTime) {
    const patterns = [];
    let current = this._randomWeather(startTime);
    let remaining = Math.floor(Math.random() * 3) + 2;

    for (let i = 0; i < days; i++) {
      if (remaining <= 0) {
        current = this._randomWeather(startTime + i * 86400000);
        remaining = Math.floor(Math.random() * 3) + 2;
      }
      patterns.push({ ...current });
      remaining--;
    }
    return patterns;
  }

  _randomWeather(timestamp) {
    // 月次の天気傾向を反映
    const month = new Date(timestamp).getMonth();
    // 梅雨（6〜7月）は雨が多い
    const isRainySeason = month === 5 || month === 6;
    // 冬（12〜2月）は快晴が多いが寒い
    const isWinter = month === 11 || month === 0 || month === 1;

    const types = [
      { name: 'clear',      indoor: 0.88, outdoor: 1.18 },
      { name: 'cloudy',     indoor: 1.00, outdoor: 1.00 },
      { name: 'rainy',      indoor: 1.12, outdoor: 0.65 },
      { name: 'heavy_rain', indoor: 1.18, outdoor: 0.48 },
      { name: 'snow',       indoor: 1.15, outdoor: 0.40 },
      { name: 'hot',        indoor: 1.12, outdoor: 0.80 },
      { name: 'cold',       indoor: 1.08, outdoor: 0.78 },
    ];

    let weights = isRainySeason
      ? [25, 20, 30, 10, 0, 10, 5]
      : isWinter
        ? [40, 25, 10, 3, 5, 0, 17]
        : [38, 28, 16, 5, 2, 6, 5];

    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < types.length; i++) {
      r -= weights[i];
      if (r <= 0) return types[i];
    }
    return types[0];
  }
}

window.dummyGenerator = new DummyGenerator();
