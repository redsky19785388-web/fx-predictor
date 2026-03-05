/**
 * dummy-generator.js - マルチエリア対応ダミーデータ生成
 * 上野公園・新宿・渋谷・池袋・六本木の各エリア特性を反映
 */

class DummyGenerator {
  constructor() {
    // ===== エリア別 基本パターン（時間帯 0-23 → 混雑度 0-100）=====

    this.areaBasePatterns = {
      // 上野公園：9〜17時が動物園・美術館コアタイム
      ueno_park: {
        weekday: [2,2,2,2,2,2,5,10,20,50,65,75,72,65,68,70,68,60,45,30,18,12,8,3],
        weekend:  [2,2,2,2,2,2,6,12,30,65,80,88,85,82,82,85,83,75,62,50,35,22,12,4],
        holiday:  [2,2,2,2,2,2,7,15,38,72,88,92,90,88,86,90,88,80,68,55,40,25,14,5]
      },
      // 新宿：通勤ラッシュ朝晩が高い、夜間も高いナイトエコノミー
      shinjuku: {
        weekday: [8,5,3,2,2,3,8,35,55,58,62,70,68,65,66,70,75,85,88,85,78,65,50,30],
        weekend:  [15,10,6,4,3,3,5,12,28,52,68,78,80,82,84,86,86,84,80,72,62,52,40,28],
        holiday:  [15,10,6,4,3,3,5,12,30,55,72,82,84,86,86,88,88,86,82,74,64,54,42,30]
      },
      // 渋谷：若者文化、土曜夕方が最高峰、スクランブルは常時混雑
      shibuya: {
        weekday: [5,3,2,2,2,2,5,18,32,45,58,65,68,65,65,68,72,78,80,75,65,55,42,22],
        weekend:  [8,5,3,2,2,3,5,15,32,55,70,80,85,88,90,92,90,88,82,72,60,48,35,20],
        holiday:  [8,5,3,2,2,3,5,15,35,58,74,84,88,90,90,92,90,88,84,74,62,50,37,22]
      },
      // 池袋：デパート・サンシャイン中心、ファミリー・オタク文化
      ikebukuro: {
        weekday: [3,2,2,2,2,2,5,25,45,55,62,68,68,65,66,68,70,75,78,72,60,48,32,15],
        weekend:  [5,3,2,2,2,2,5,15,35,60,75,82,85,84,84,86,85,82,76,65,55,44,30,15],
        holiday:  [5,3,2,2,2,2,5,15,38,63,78,86,88,86,86,88,87,84,78,67,57,46,32,17]
      },
      // 六本木：昼間低調、深夜ナイトライフで最高峰
      roppongi: {
        weekday: [25,15,8,4,3,3,3,8,15,25,38,48,50,48,45,48,55,65,78,85,88,88,82,55],
        weekend:  [40,35,25,18,12,8,5,8,18,32,48,58,62,62,60,62,68,78,88,92,95,95,88,65],
        holiday:  [35,30,22,15,10,7,5,8,20,35,50,60,64,64,62,64,70,80,88,92,95,92,85,60]
      }
    };

    // 後方互換
    this.uenoBasePatterns = this.areaBasePatterns.ueno_park;

    // ===== ゾーンタイプ別 時間帯係数 =====
    this.zoneCoefficients = {
      // --- 既存 ---
      cafe:    [0.1,0.1,0.1,0.1,0.1,0.1,0.2,0.5,0.9,1.0,1.1,1.4,1.5,1.3,1.2,1.2,1.1,1.0,0.9,0.7,0.5,0.4,0.3,0.1],
      museum:  [0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.1,0.5,1.0,1.2,1.1,1.0,1.1,1.2,1.1,0.8,0.4,0.1,0.0,0.0,0.0,0.0,0.0],
      park:    [0.1,0.1,0.1,0.1,0.1,0.2,0.4,0.8,1.1,1.2,1.2,1.3,1.3,1.2,1.2,1.2,1.1,1.0,0.8,0.6,0.4,0.3,0.2,0.1],
      shrine:  [0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.2,0.6,1.1,1.3,1.2,1.0,1.1,1.2,1.1,0.9,0.6,0.3,0.1,0.0,0.0,0.0,0.0],
      leisure: [0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.1,0.3,0.8,1.2,1.4,1.3,1.3,1.3,1.2,1.1,0.8,0.4,0.1,0.0,0.0,0.0,0.0],
      market:  [0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.2,0.5,0.9,1.1,1.2,1.2,1.1,1.1,1.2,1.3,1.4,1.4,1.2,1.0,0.8,0.5,0.2],
      // --- 新規追加 ---
      // エンタメ（歌舞伎町・六本木）：深夜〜早朝が最高峰
      entertainment: [1.2,1.0,0.7,0.4,0.2,0.1,0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.7,0.7,0.8,1.0,1.2,1.5,1.8,1.9,2.0,1.9,1.6],
      // オフィス（新宿西口）：平日ラッシュのみ
      office:        [0.0,0.0,0.0,0.0,0.0,0.0,0.1,0.7,1.5,1.3,1.2,1.2,0.9,1.2,1.3,1.3,0.9,0.5,0.2,0.1,0.1,0.0,0.0,0.0],
      // ショッピング（百貨店・商業施設）：10〜20時
      shopping:      [0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.1,0.4,0.9,1.2,1.3,1.2,1.1,1.2,1.4,1.5,1.4,1.2,0.9,0.5,0.2,0.1,0.0],
      // 複合施設（ヒルズ・ミッドタウン・サンシャイン）：昼〜夜
      complex:       [0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.2,0.5,1.0,1.2,1.2,1.1,1.1,1.2,1.3,1.4,1.5,1.3,1.0,0.7,0.4,0.1,0.0],
      // 交差点（スクランブル）：終日高め、夕方ピーク
      crossing:      [0.2,0.1,0.1,0.1,0.1,0.2,0.4,0.8,1.0,1.1,1.2,1.3,1.3,1.2,1.2,1.3,1.5,1.6,1.6,1.4,1.1,0.8,0.5,0.3],
      // サブカル専門（乙女ロード）：週末午後ピーク
      specialty:     [0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.2,0.5,0.9,1.2,1.3,1.3,1.4,1.5,1.5,1.3,1.0,0.7,0.4,0.2,0.0,0.0]
    };

    // ===== エリア別 月次季節補正 =====
    this.areaMonthMultipliers = {
      ueno_park: {
        overall: [0.70,0.75,1.00,1.20,1.00,0.85,0.95,1.00,0.90,1.00,1.05,0.90],
        park:    [0.45,0.50,1.20,2.50,0.90,0.70,0.85,0.90,0.80,1.00,1.10,0.65],
        cafe:    [0.70,0.75,1.30,2.00,1.10,0.90,1.00,1.05,0.95,1.05,1.10,1.20],
        museum:  [0.85,0.85,1.00,1.10,1.00,0.80,0.85,0.90,0.90,1.10,1.20,0.95],
        leisure: [0.00,0.00,0.30,0.80,1.00,1.00,1.10,1.10,1.00,0.80,0.20,0.00],
        market:  [0.75,0.80,0.90,1.00,1.00,0.85,0.90,0.90,0.85,0.90,0.95,1.80]
      },
      shinjuku: {
        overall:       [0.85,0.85,0.95,1.05,1.00,0.90,0.95,0.98,0.92,1.00,1.05,1.10],
        entertainment: [0.80,0.80,0.90,1.00,1.05,0.95,1.00,1.00,0.95,1.00,1.05,1.20],
        office:        [0.90,0.90,0.95,0.98,0.95,0.88,0.90,0.90,0.92,0.95,0.98,0.88],
        park:          [0.40,0.50,1.10,1.60,1.00,0.75,0.80,0.82,0.78,0.95,1.00,0.60],
        shopping:      [0.80,0.85,0.95,1.05,1.05,0.90,0.90,0.95,0.90,1.00,1.05,1.30]
      },
      shibuya: {
        overall:  [0.82,0.85,0.95,1.08,1.05,0.90,0.95,1.00,0.92,1.00,1.08,1.05],
        crossing: [0.80,0.85,0.95,1.10,1.10,0.92,0.96,1.02,0.94,1.00,1.10,1.05],
        shopping: [0.78,0.82,0.95,1.10,1.10,0.88,0.92,0.98,0.90,1.00,1.10,1.15],
        complex:  [0.80,0.85,0.95,1.08,1.05,0.88,0.92,0.97,0.90,1.00,1.08,1.10],
        park:     [0.50,0.55,1.05,1.40,1.00,0.78,0.82,0.84,0.80,0.95,1.02,0.65]
      },
      ikebukuro: {
        overall:   [0.82,0.85,0.95,1.05,1.05,0.88,0.92,0.95,0.90,1.00,1.05,1.12],
        complex:   [0.82,0.85,0.95,1.08,1.08,0.88,0.92,0.97,0.90,1.00,1.08,1.15],
        shopping:  [0.82,0.85,0.95,1.05,1.05,0.88,0.90,0.95,0.90,1.00,1.05,1.20],
        specialty: [0.75,0.80,0.92,1.05,1.10,0.90,0.95,1.00,0.92,1.05,1.08,1.00],
        park:      [0.45,0.50,1.00,1.30,1.00,0.78,0.82,0.84,0.80,0.95,1.00,0.60]
      },
      roppongi: {
        overall:       [0.80,0.82,0.90,1.00,1.02,0.92,0.95,0.98,0.92,1.00,1.05,1.12],
        entertainment: [0.78,0.80,0.88,0.98,1.05,0.95,0.98,1.00,0.93,1.00,1.05,1.18],
        complex:       [0.80,0.83,0.92,1.02,1.02,0.90,0.93,0.97,0.90,1.00,1.06,1.10],
        museum:        [0.85,0.85,0.95,1.10,1.05,0.85,0.88,0.90,0.90,1.08,1.18,0.95],
        park:          [0.45,0.50,1.00,1.30,1.00,0.75,0.78,0.80,0.75,0.92,0.98,0.55]
      }
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
   * エリア対応ダミーデータ生成
   * @param {string} facilityType - 'ueno'|'shinjuku'|'shibuya'|'ikebukuro'|'roppongi'
   * @param {number} days
   * @param {Object} options
   * @param {Array}  zones
   */
  generate(facilityType = 'ueno', days = 30, options = {}, zones = []) {
    const { includeEvents=true, includeWeather=true, includeHolidays=true } = options;

    const areaId       = facilityType === 'ueno' ? 'ueno_park' : facilityType;
    const basePatterns = this.areaBasePatterns[areaId] || this.areaBasePatterns.ueno_park;
    const monthMults   = this.areaMonthMultipliers[areaId] || this.areaMonthMultipliers.ueno_park;
    const openHour     = this._getFacilityOpenHour(areaId);
    const closeHour    = this._getFacilityCloseHour(areaId);
    const is24h        = closeHour >= 24;

    const records    = [];
    const now        = Date.now();
    const startTime  = now - days * 86400000;
    const weatherPat = this._generateWeatherPattern(days, startTime);

    for (let dayOffset = 0; dayOffset < days; dayOffset++) {
      const dayStart   = startTime + dayOffset * 86400000;
      const dayDate    = new Date(dayStart);
      const dateStr    = dayDate.toISOString().split('T')[0];
      const dow        = dayDate.getDay();
      const month      = dayDate.getMonth();
      const dayOfMonth = dayDate.getDate();
      const isWeekend  = dow === 0 || dow === 6;
      const isHoliday  = includeHolidays && this.holidays.has(dateStr);
      const isMonday   = dow === 1;
      const isTuesday  = dow === 2;

      const basePat  = isHoliday ? basePatterns.holiday : isWeekend ? basePatterns.weekend : basePatterns.weekday;
      const weather  = includeWeather ? weatherPat[dayOffset] : { name: 'clear', indoor: 1.0, outdoor: 1.0 };
      const cherryMod = this._getCherryBlossomMod(month, dayOfMonth);

      for (let hour = 0; hour < 24; hour++) {
        const timestamp = dayStart + hour * 3600000 + Math.floor(Math.random() * 45) * 60000;

        for (const zone of zones) {
          const zoneType = zone.type;
          const isIndoor = zone.isIndoor !== false;

          let level = basePat[hour];
          level *= this._getZoneCoeff(zoneType, hour);
          level *= this._getMonthMultiplier(monthMults, zoneType, month);
          level *= isIndoor ? weather.indoor : weather.outdoor;

          if (areaId === 'ueno_park') {
            level = this._applyUenoSpecial(level, zone, month, dayOfMonth, dow, isMonday, weather);
            if (cherryMod > 1.0) level *= this._getCherryZoneMult(zoneType, cherryMod);
          } else {
            level = this._applyAreaSpecial(level, zone, areaId, month, dayOfMonth, dow, isMonday, isTuesday, weather);
          }

          level *= 0.88 + Math.random() * 0.24;

          // 営業時間外
          if (!is24h && (hour < openHour || hour >= closeHour)) {
            level = Math.random() * 3;
          }
          // ボート冬季閉鎖
          if (zoneType === 'leisure' && (month < 2 || month > 10)) level = Math.random() * 2;
          // 休館日
          if (isMonday  && zone.closedOnMonday)  level = Math.random() * 3;
          if (isTuesday && zone.closedOnTuesday) level = Math.random() * 3;

          level = Math.max(0, Math.min(100, Math.round(level)));
          records.push({ zoneId: zone.id, timestamp, crowdingLevel: level,
                         visitorCount: Math.round((zone.capacity || 100) * level / 100) });
        }
      }
    }

    const count = dataManager.saveBulkRecords(records);
    console.log(`[DummyGenerator] ${areaId} ${count}件のデータを生成しました`);
    return count;
  }

  // -------- エリア固有補正 --------

  _applyAreaSpecial(level, zone, areaId, month, day, dow, isMonday, isTuesday, weather) {
    let mod = level;

    if (areaId === 'shinjuku') {
      if (month === 11 && (zone.type === 'shopping' || zone.type === 'entertainment')) mod *= 1.6;
      if ((month === 3 && day >= 29) || (month === 4 && day <= 5)) mod *= 1.5;
      if (isMonday && zone.id === 'shinjuku_gyoen') mod *= 0.05;
      if (zone.id === 'shinjuku_gyoen' && month === 2 && day >= 20) mod *= 2.2;
      if (zone.id === 'shinjuku_gyoen' && month === 3 && day <= 15) mod *= 2.0;
      if (month === 9 && day >= 28) mod *= (zone.type === 'entertainment' ? 2.0 : 1.2);
      if ((weather.name === 'rainy' || weather.name === 'heavy_rain') && !zone.isIndoor) mod *= 0.60;
      if ((weather.name === 'rainy' || weather.name === 'heavy_rain') && (zone.type === 'shopping' || zone.type === 'complex')) mod *= 1.15;
    }

    if (areaId === 'shibuya') {
      if (month === 9 && day >= 28) {
        mod *= (zone.id === 'shibuya_scramble' ? 3.0 : zone.id === 'shibuya_center' ? 2.0 : 1.5);
      }
      if (dow === 6) mod *= 1.25;
      if ((month === 3 && day >= 29) || (month === 4 && day <= 5)) mod *= 1.4;
      if (month === 11 && day >= 20) mod *= 1.5;
      if ((weather.name === 'rainy' || weather.name === 'heavy_rain') && !zone.isIndoor) mod *= 0.55;
      if ((weather.name === 'rainy' || weather.name === 'heavy_rain') && (zone.type === 'complex' || zone.type === 'shopping')) mod *= 1.20;
    }

    if (areaId === 'ikebukuro') {
      if (zone.id === 'ikebukuro_otome' && dow === 6) mod *= 1.6;
      if (zone.id === 'ikebukuro_otome' && dow === 0) mod *= 1.5;
      if ((month === 6 || month === 7) && zone.id === 'ikebukuro_sunshine') mod *= 1.4;
      if ((month === 3 && day >= 29) || (month === 4 && day <= 5)) mod *= 1.6;
      if (month === 11 && day >= 15) mod *= 1.4;
      if ((weather.name === 'rainy' || weather.name === 'heavy_rain') && !zone.isIndoor) mod *= 0.60;
      if ((weather.name === 'rainy' || weather.name === 'heavy_rain') && (zone.type === 'shopping' || zone.type === 'complex')) mod *= 1.18;
    }

    if (areaId === 'roppongi') {
      if (isTuesday && zone.id === 'roppongi_nact') mod *= 0.05;
      if ((month === 2 || month === 3 || month === 9 || month === 10) && zone.id === 'roppongi_nact') mod *= 1.5;
      if ((month === 6 || month === 7) && zone.type === 'entertainment') mod *= 1.4;
      if (month === 11 && day >= 30 && zone.type === 'entertainment') mod *= 2.5;
      if (month === 11 && day >= 10 && zone.id === 'roppongi_midtown') mod *= 1.4;
      if ((weather.name === 'rainy' || weather.name === 'heavy_rain') && !zone.isIndoor) mod *= 0.55;
      if ((weather.name === 'rainy' || weather.name === 'heavy_rain') && zone.type === 'complex') mod *= 1.20;
    }

    return mod;
  }

  // -------- 上野公園固有補正（後方互換）--------

  _getCherryBlossomMod(month, day) {
    if (month === 2 && day >= 28) return 3.5;
    if (month === 3 && day <= 7)  return 3.5;
    if (month === 2 && day >= 20) return 2.0;
    if (month === 3 && day <= 15) return 1.6;
    return 1.0;
  }

  _getCherryZoneMult(zoneType, baseMod) {
    const b = { park:baseMod, cafe:baseMod*0.70, market:baseMod*0.55,
                shrine:baseMod*0.60, museum:baseMod*0.40, leisure:baseMod*0.50 };
    return b[zoneType] || baseMod * 0.45;
  }

  _applyUenoSpecial(level, zone, month, day, dow, isMonday, weather) {
    let mod = level;
    if (isMonday && zone.closedOnMonday) mod *= CONFIG.museumMondayEffect;
    if (zone.id === 'zone_toshogu' && month === 3 && day >= 10) mod *= 1.5;
    if (zone.id === 'zone_toshogu' && month === 4 && day <= 10) mod *= 1.5;
    if (zone.id === 'zone_toshogu' && (month === 0 || (month === 1 && day <= 20))) mod *= 1.3;
    if (zone.id === 'zone_shinobazu_boat' && (month === 6 || month === 7)) mod *= 1.35;
    if (zone.id === 'zone_ameyoko' && month === 11 && day >= 27) mod *= 3.0;
    if (zone.id === 'zone_ameyoko' && month === 11 && day >= 24) mod *= 1.8;
    if ((month === 3 && day >= 29) || (month === 4 && day <= 5)) mod *= 1.8;
    if ((month === 6 || month === 7) && !zone.isIndoor && weather.name === 'hot') mod *= 0.75;
    if ((month === 6 || month === 7) && zone.isIndoor  && weather.name === 'hot') mod *= 1.15;
    if (weather.name === 'rainy'      && !zone.isIndoor) mod *= 0.60;
    if (weather.name === 'heavy_rain' && !zone.isIndoor) mod *= 0.40;
    const cm = this._getCherryBlossomMod(month, day);
    if (cm > 1.5 && weather.name === 'rainy' && zone.type === 'cafe') mod *= 1.4;
    return mod;
  }

  // -------- 共通ヘルパー --------

  _getZoneCoeff(zoneType, hour) {
    const c = this.zoneCoefficients[zoneType] || this.zoneCoefficients.park;
    return c[hour];
  }

  _getMonthMultiplier(monthMults, zoneType, month) {
    const m = monthMults[zoneType] || monthMults.overall;
    return m ? (m[month] || 1.0) : 1.0;
  }

  _getFacilityOpenHour(areaId) {
    return { ueno_park:6, shinjuku:0, shibuya:6, ikebukuro:7, roppongi:0 }[areaId] ?? 6;
  }

  _getFacilityCloseHour(areaId) {
    return { ueno_park:23, shinjuku:24, shibuya:24, ikebukuro:23, roppongi:24 }[areaId] ?? 23;
  }

  _generateWeatherPattern(days, startTime) {
    const patterns = [];
    let current = this._randomWeather(startTime);
    let remaining = Math.floor(Math.random() * 3) + 2;
    for (let i = 0; i < days; i++) {
      if (remaining <= 0) { current = this._randomWeather(startTime + i * 86400000); remaining = Math.floor(Math.random() * 3) + 2; }
      patterns.push({ ...current });
      remaining--;
    }
    return patterns;
  }

  _randomWeather(timestamp) {
    const month = new Date(timestamp).getMonth();
    const isRainy  = month === 5 || month === 6;
    const isWinter = month === 11 || month === 0 || month === 1;
    const types = [
      {name:'clear',      indoor:0.88,outdoor:1.18},
      {name:'cloudy',     indoor:1.00,outdoor:1.00},
      {name:'rainy',      indoor:1.12,outdoor:0.65},
      {name:'heavy_rain', indoor:1.18,outdoor:0.48},
      {name:'snow',       indoor:1.15,outdoor:0.40},
      {name:'hot',        indoor:1.12,outdoor:0.80},
      {name:'cold',       indoor:1.08,outdoor:0.78},
    ];
    const w = isRainy ? [25,20,30,10,0,10,5] : isWinter ? [40,25,10,3,5,0,17] : [38,28,16,5,2,6,5];
    const total = w.reduce((a,b)=>a+b,0);
    let r = Math.random() * total;
    for (let i = 0; i < types.length; i++) { r -= w[i]; if (r <= 0) return types[i]; }
    return types[0];
  }
}

window.dummyGenerator = new DummyGenerator();
