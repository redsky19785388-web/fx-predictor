/**
 * prediction-engine.js - 上野公園特化 多変数混雑予測エンジン v2.0
 *
 * 予測式:
 *   predicted = base_historical × weather_modifier × event_modifier
 *             × day_type_modifier × cherry_blossom_modifier × monday_museum_modifier
 *
 * 上野特有のモディファイア:
 *   - cherry_blossom_modifier : 桜シーズン（3月下旬〜4月）の爆発的増加
 *   - monday_museum_modifier  : 月曜の美術館・博物館休館による人流変化
 *   - seasonal_modifier       : 上野公園の季節パターン（蓮、紅葉、年末等）
 */

class PredictionEngine {
  constructor() {
    this.dataManager   = null;
    this.weatherClient = null;
    this.eventManager  = null;
    this._predictionCache = {};
    this._cacheExpiry = 10 * 60 * 1000; // 10分
  }

  init(dataManager, weatherClient, eventManager) {
    this.dataManager   = dataManager;
    this.weatherClient = weatherClient;
    this.eventManager  = eventManager;
    console.log('[PredictionEngine] 上野公園モード 初期化完了');
  }

  // ----------------------------------------------------------------
  // 公開API
  // ----------------------------------------------------------------

  /** 特定ゾーン・日付の24時間分予測 */
  async predictDay(zoneId, targetDate) {
    const cacheKey = `${zoneId}_${new Date(targetDate).toDateString()}`;
    const cached = this._predictionCache[cacheKey];
    if (cached && Date.now() - cached.cachedAt < this._cacheExpiry) return cached.data;

    const zone = this._findZone(zoneId);
    if (!zone) return this._emptyPredictions(zoneId, targetDate);

    await this.weatherClient.fetchForecast();

    const predictions = [];
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);

    for (let hour = 0; hour < 24; hour++) {
      const targetTs = dayStart.getTime() + hour * 3600000;
      predictions.push(await this._predictHour(zone, targetTs));
    }

    this._predictionCache[cacheKey] = { data: predictions, cachedAt: Date.now() };
    return predictions;
  }

  /** 翌72時間のキーポイント予測（ピーク・閑散検出） */
  async predictKeyPoints(zoneId) {
    const zone = this._findZone(zoneId);
    if (!zone) return [];
    await this.weatherClient.fetchForecast();
    const keyPoints = [];
    const now = Date.now();
    for (let h = 0; h < 72; h++) {
      const targetTs = now + h * 3600000;
      const pred = await this._predictHour(zone, targetTs);
      if (pred.predictedLevel >= CONFIG.alerts.highCrowdingThreshold ||
          pred.predictedLevel <= CONFIG.alerts.lowCrowdingThreshold) {
        keyPoints.push(pred);
      }
    }
    return keyPoints;
  }

  // ----------------------------------------------------------------
  // コア予測
  // ----------------------------------------------------------------

  async _predictHour(zone, targetTs) {
    const targetDate = new Date(targetTs);
    const hour       = targetDate.getHours();
    const dow        = targetDate.getDay(); // 0=日〜6=土
    const month      = targetDate.getMonth() + 1; // 1-12
    const day        = targetDate.getDate();

    // 上野公園の営業時間（5時〜22時）
    const isOpen = hour >= 5 && hour < 22;
    if (!isOpen) {
      return this._makePrediction(zone.id, targetTs, 1, 0,
        { historicalBase:1, weatherMod:1, eventMod:1, dayTypeMod:1,
          cherryBlossomMod:1, mondayMuseumMod:1 });
    }

    // ① 過去データから基準値
    const historicalData = this.dataManager.getHistoricalPattern(zone.id, dow, hour, 8);
    const { base, confidence } = this._calculateHistoricalBase(historicalData, zone, hour, dow);

    // ② 天気モディファイア
    const weather    = this.weatherClient.getForecastForDateTime(targetTs);
    const weatherMod = this.weatherClient.getWeatherModifier(weather, zone.isIndoor === true);

    // ③ イベントモディファイア（ゾーン考慮）
    const nearbyEvents = this.eventManager.getEventsForDatetime(targetTs, zone.id);
    const eventMod     = this.eventManager.getEventModifier(nearbyEvents, zone.id);

    // ④ 曜日タイプモディファイア
    const dayTypeMod = this._getDayTypeModifier(targetDate);

    // ⑤ 桜シーズンモディファイア（上野公園固有）
    const cherryBlossomMod = this._getCherryBlossomModifier(zone, month, day);

    // ⑥ 月曜休館モディファイア（美術館・博物館固有）
    const mondayMuseumMod = this._getMondayMuseumModifier(zone, dow);

    // ⑦ 季節モディファイア
    const seasonalMod = this._getUenoSeasonalModifier(zone, month, day);

    // 合成
    let predicted = base
      * weatherMod
      * eventMod
      * dayTypeMod
      * cherryBlossomMod
      * mondayMuseumMod
      * seasonalMod;
    predicted = Math.max(1, Math.min(100, Math.round(predicted)));

    return this._makePrediction(zone.id, targetTs, predicted, confidence, {
      historicalBase:    Math.round(base),
      weatherMod:        parseFloat(weatherMod.toFixed(2)),
      eventMod:          parseFloat(eventMod.toFixed(2)),
      dayTypeMod:        parseFloat(dayTypeMod.toFixed(2)),
      cherryBlossomMod:  parseFloat(cherryBlossomMod.toFixed(2)),
      mondayMuseumMod:   parseFloat(mondayMuseumMod.toFixed(2)),
      seasonalMod:       parseFloat(seasonalMod.toFixed(2)),
      weatherInfo:       weather,
      events:            nearbyEvents.map(e => ({ name: e.name, impact: e.impact }))
    });
  }

  // ----------------------------------------------------------------
  // モディファイア計算
  // ----------------------------------------------------------------

  /** ① 過去データ加重平均基準値 */
  _calculateHistoricalBase(historicalData, zone, hour, dow) {
    if (historicalData.length === 0) {
      return { base: this._getDefaultBase(zone.type, hour, dow), confidence: 0.30 };
    }
    const now = Date.now();
    let weightedSum = 0, weightTotal = 0;
    for (const record of historicalData) {
      const ageWeeks = (now - record.timestamp) / (7 * 86400000);
      const weight   = Math.exp(-0.3 * ageWeeks);
      weightedSum   += record.crowdingLevel * weight;
      weightTotal   += weight;
    }
    const base       = weightedSum / weightTotal;
    const confidence = Math.min(0.95, 0.40 + historicalData.length * 0.055);
    return { base, confidence };
  }

  /** データなし時のデフォルト基準値（上野ゾーンタイプ対応） */
  _getDefaultBase(zoneType, hour, dow) {
    const isWeekend = dow === 0 || dow === 6;
    // 時間帯パターン（0〜23時）
    const patterns = {
      cafe:    [0,0,0,0,0,5,10,18,35,55,65,72,75,70,60,62,65,68,62,50,35,20,8,2],
      museum:  [0,0,0,0,0,0,0,0,10,35,55,70,68,60,62,65,70,72,65,50,30,10,2,0],
      park:    [0,0,0,0,2,8,18,30,45,60,68,75,78,72,65,68,72,75,70,60,45,30,15,4],
      shrine:  [0,0,0,0,0,5,12,25,45,60,65,68,65,60,55,58,62,65,60,50,35,20,8,2],
      leisure: [0,0,0,0,0,0,0,5,15,30,50,65,68,65,60,65,72,75,70,58,40,20,5,0],
      market:  [0,0,0,0,0,0,5,10,25,45,60,72,75,70,65,68,72,80,82,75,60,40,18,5],
    };
    const base = (patterns[zoneType] || patterns.park)[hour];
    return isWeekend ? base * 1.35 : base;
  }

  /** ② 曜日タイプモディファイア */
  _getDayTypeModifier(date) {
    const dow     = date.getDay();
    const dateStr = date.toISOString().split('T')[0];
    const isHoliday = dummyGenerator?.holidays?.has(dateStr);
    if (isHoliday) return 1.55;
    if (dow === 0 || dow === 6) return 1.40; // 週末
    const weekdayMods = [1.0, 0.88, 0.86, 0.88, 0.92, 1.08, 1.0];
    return weekdayMods[dow];
  }

  /**
   * ⑤ 桜シーズンモディファイア（上野公園固有）
   * - ピーク期: 3/28〜4/7  → park 3.5x, cafe 2.0x, shrine 1.8x, leisure 1.6x
   * - 通常開花: 3/20〜4/15 → park 2.1x, cafe 1.5x
   * - 前後期:   3/15〜4/20 → park 1.3x
   */
  _getCherryBlossomModifier(zone, month, day) {
    if (month === 3 && day >= 28 || month === 4 && day <= 7) {
      // ピーク期
      const peakBoost = { park: 3.5, cafe: 2.0, shrine: 1.8, leisure: 1.6, museum: 1.3, market: 1.4 };
      return peakBoost[zone.type] || 1.2;
    }
    if ((month === 3 && day >= 20) || (month === 4 && day <= 15)) {
      // 開花シーズン
      const bloomBoost = { park: 2.1, cafe: 1.5, shrine: 1.4, leisure: 1.3, museum: 1.15, market: 1.2 };
      return bloomBoost[zone.type] || 1.1;
    }
    if ((month === 3 && day >= 15) || (month === 4 && day <= 20)) {
      const transBoost = { park: 1.3, cafe: 1.2, shrine: 1.15, leisure: 1.1, museum: 1.05, market: 1.1 };
      return transBoost[zone.type] || 1.05;
    }
    return 1.0;
  }

  /**
   * ⑥ 月曜休館モディファイア
   * 美術館・博物館は月曜休館 → 来客数が平常の18%程度に激減
   */
  _getMondayMuseumModifier(zone, dow) {
    if (dow !== 1) return 1.0; // 月曜以外は影響なし
    if (zone.closedOnMonday === true) return CONFIG.museumMondayEffect || 0.18;
    // museum/shrine タイプは月曜に若干減少
    if (zone.type === 'museum') return 0.22;
    if (zone.type === 'shrine') return 0.75;
    return 1.0;
  }

  /**
   * ⑦ 上野公園季節モディファイア
   * - ぼたん祭り（4/10〜5/6）: shrine 1.6x
   * - 蓮の開花（7/20〜8/10）: leisure 1.4x
   * - 年末アメ横（12/25〜31）: market 3.0x
   * - GW（4/29〜5/6）: 全体 1.5x
   */
  _getUenoSeasonalModifier(zone, month, day) {
    // ゴールデンウィーク
    if ((month === 4 && day >= 29) || (month === 5 && day <= 6)) return 1.5;
    // ぼたん祭り
    if (zone.type === 'shrine' &&
        ((month === 4 && day >= 10) || (month === 5 && day <= 6))) return 1.6;
    // 蓮の開花（不忍池）
    if (zone.type === 'leisure' && month === 7 && day >= 20) return 1.4;
    if (zone.type === 'leisure' && month === 8 && day <= 10) return 1.3;
    // 年末アメ横
    if (zone.type === 'market' && month === 12 && day >= 25) return 3.0;
    // 秋の紅葉
    if ((zone.type === 'park' || zone.type === 'shrine') &&
        month === 11 && day >= 15) return 1.4;
    return 1.0;
  }

  // ----------------------------------------------------------------
  // レコメンデーション生成（上野公園特化）
  // ----------------------------------------------------------------

  generateRecommendations(predictions, zone) {
    const recommendations = [];
    const settings      = dataManager.getSettings();
    const highThreshold = settings.highCrowdingThreshold || CONFIG.alerts.highCrowdingThreshold;
    const lowThreshold  = settings.lowCrowdingThreshold  || CONFIG.alerts.lowCrowdingThreshold;

    for (const pred of predictions) {
      if (!pred?.predictedLevel) continue;
      const hour = new Date(pred.targetTs).getHours();

      if (pred.predictedLevel >= highThreshold) {
        recommendations.push({
          type:     'high_crowding',
          severity: pred.predictedLevel >= 90 ? 'critical' : 'high',
          time:     pred.targetTs,
          zone:     zone.name,
          message:  this._buildHighMessage(pred, zone),
          action:   this._getHighCrowdingAction(pred, zone),
          factors:  pred.factors
        });
      } else if (pred.predictedLevel <= lowThreshold) {
        recommendations.push({
          type:     'low_crowding',
          severity: 'info',
          time:     pred.targetTs,
          zone:     zone.name,
          message:  this._buildLowMessage(pred, zone),
          action:   this._getLowCrowdingAction(pred, zone),
          factors:  pred.factors
        });
      }
    }

    // 天気影響
    recommendations.push(...this._detectWeatherImpacts(predictions, zone));
    // 桜シーズン特報
    recommendations.push(...this._detectCherryBlossomAlert(predictions, zone));

    return recommendations
      .filter((r, i, arr) => arr.findIndex(x => x.time === r.time && x.type === r.type) === i)
      .sort((a, b) => a.time - b.time)
      .slice(0, 10);
  }

  _buildHighMessage(pred, zone) {
    const hour  = new Date(pred.targetTs).getHours();
    const f     = pred.factors || {};
    const parts = [`${zone.name}で${hour}時台に混雑ピーク（予測: ${pred.predictedLevel}%）が見込まれます。`];
    if (f.cherryBlossomMod > 1.5) parts.push(`🌸 桜シーズン（×${f.cherryBlossomMod.toFixed(1)}）の影響で通常比${Math.round(f.cherryBlossomMod*100-100)}%増。`);
    if (f.eventMod > 1.2 && f.events?.length > 0) parts.push(`イベント「${f.events[0].name}」の集客効果あり。`);
    if (f.dayTypeMod >= 1.4) parts.push(`週末・祝日の家族連れ需要増。`);
    return parts.join('');
  }

  _buildLowMessage(pred, zone) {
    const hour = new Date(pred.targetTs).getHours();
    const f    = pred.factors || {};
    const parts = [`${zone.name}で${hour}時台に閑散（予測: ${pred.predictedLevel}%）が見込まれます。`];
    if (f.mondayMuseumMod < 0.5) parts.push(`月曜休館により周辺人流が大幅減少。`);
    if (f.weatherMod < 0.8) parts.push(`悪天候による来客減少が主因です。`);
    return parts.join('');
  }

  _getHighCrowdingAction(pred, zone) {
    const level = pred.predictedLevel;
    const f     = pred.factors || {};
    const actions = [];

    if (zone.type === 'cafe') {
      const extra = Math.ceil((level - 50) / 20);
      actions.push(`スタッフを${extra}名増員し、テイクアウト専用レーンを設置してください`);
      if (level >= 85) actions.push('セルフ会計端末の活用で回転率を高めてください');
    } else if (zone.type === 'museum') {
      actions.push('入場整理券の発行と入口スタッフの追加配置を推奨します');
      if (level >= 90) actions.push('入場待ち列の屋外誘導と時間指定制の導入を検討してください');
    } else if (zone.type === 'park') {
      actions.push('仮設トイレ・ゴミ箱の増設と清掃スタッフの追加配置を推奨します');
      if (f.cherryBlossomMod > 1.5) actions.push('桜ライトアップ期間中は夜間警備員も配置してください');
    } else if (zone.type === 'leisure') {
      actions.push('ボート乗り場の追加スタッフと安全員の配置を推奨します');
    } else if (zone.type === 'market') {
      actions.push('通路の一方通行化と警備員の増員を推奨します');
    } else if (zone.type === 'shrine') {
      actions.push('参拝・入場整理スタッフを増員し、混雑状況の随時アナウンスを行ってください');
    } else {
      actions.push(`スタッフを通常比${Math.round(level/50*100)}%増員してください`);
    }

    if (f.eventMod > 1.3 && f.events?.length > 0) {
      actions.push(`「${f.events[0].name}」関連の案内表示・誘導対応を強化してください`);
    }
    return actions.join('。') + '。';
  }

  _getLowCrowdingAction(pred, zone) {
    const f     = pred.factors || {};
    const hour  = new Date(pred.targetTs).getHours();
    const actions = [];

    actions.push('この時間帯にスタッフの休憩・シフト調整を実施してください');

    if (f.mondayMuseumMod < 0.5) {
      actions.push('月曜は美術館休館のため周辺の来客が少ない傾向です。仕込み・清掃作業に活用してください');
    }
    if (f.weatherMod < 0.80) {
      const reduction = Math.round((1 - f.weatherMod) * 100);
      actions.push(`悪天候により来客が約${reduction}%減少する見込みです。少人数シフトへの変更を検討してください`);
    }
    if (zone.type === 'cafe' || zone.type === 'market') {
      actions.push('閑散時間帯を活用したタイムセール・特別メニューで来客を促進することも有効です');
    }
    return actions.join('。') + '。';
  }

  _detectWeatherImpacts(predictions, zone) {
    const alerts = [];
    let maxImpact = { mod: 1.0, pred: null };
    for (const pred of predictions) {
      if (!pred?.factors) continue;
      const mod = pred.factors.weatherMod || 1;
      if (Math.abs(1 - mod) > Math.abs(1 - maxImpact.mod)) maxImpact = { mod, pred };
    }
    const threshold = (CONFIG.alerts.weatherImpactThreshold || 20) / 100;
    if (maxImpact.pred && Math.abs(1 - maxImpact.mod) > threshold) {
      const pct       = Math.round(Math.abs(1 - maxImpact.mod) * 100);
      const direction = maxImpact.mod > 1 ? '増加' : '減少';
      const weather   = maxImpact.pred.factors.weatherInfo;
      alerts.push({
        type:     'weather_impact',
        severity: 'warning',
        time:     maxImpact.pred.targetTs,
        zone:     zone.name,
        message:  `天気の影響で${zone.name}の来客が最大${pct}%${direction}する見込みです。${weather?.description ? `（${weather.icon} ${weather.description}）` : ''}`,
        action:   maxImpact.mod > 1
          ? '雨天による館内集中に備え、傘立て・待合スペースを増設してください。'
          : 'スタッフシフトを削減し、運営コストを最適化することを推奨します。',
        factors: maxImpact.pred.factors
      });
    }
    return alerts;
  }

  /** 桜シーズン特別アラート */
  _detectCherryBlossomAlert(predictions, zone) {
    if (zone.type !== 'park' && zone.type !== 'cafe') return [];
    const peakPred = predictions.find(p => p.factors?.cherryBlossomMod >= 2.0);
    if (!peakPred) return [];
    const mult = Math.round(peakPred.factors.cherryBlossomMod * 100);
    return [{
      type:     'cherry_blossom',
      severity: 'warning',
      time:     peakPred.targetTs,
      zone:     zone.name,
      message:  `🌸 桜シーズン（×${peakPred.factors.cherryBlossomMod.toFixed(1)}）のため${zone.name}で通常比${mult-100}%増の大混雑が予測されます。`,
      action:   zone.type === 'cafe'
        ? '臨時メニューの準備・テイクアウト体制強化・スタッフ3名以上の増員を推奨します。桜ライトアップ期間の夜間営業延長も検討してください。'
        : '仮設トイレ・ゴミ箱の増設、警備員の増員、飲食物の持ち込みルール周知を推奨します。',
      factors: peakPred.factors
    }];
  }

  // ----------------------------------------------------------------
  // ユーティリティ
  // ----------------------------------------------------------------

  getPeakTime(predictions) {
    if (!predictions?.length) return null;
    const open = predictions.filter(p => {
      const h = new Date(p.targetTs).getHours();
      return h >= 5 && h < 22;
    });
    return open.length ? open.reduce((mx, p) => p.predictedLevel > mx.predictedLevel ? p : mx) : null;
  }

  getConfidencePercent(confidence) { return Math.round(confidence * 100); }

  clearCache() { this._predictionCache = {}; }

  _makePrediction(zoneId, targetTs, predictedLevel, confidence, factors) {
    return { zoneId, targetTs, predictedLevel, confidence: parseFloat(confidence.toFixed(2)), factors, generatedAt: Date.now() };
  }

  _emptyPredictions(zoneId, targetDate) {
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    return Array.from({ length: 24 }, (_, h) => ({
      zoneId, targetTs: dayStart.getTime() + h * 3600000,
      predictedLevel: 0, confidence: 0, factors: {}
    }));
  }

  _findZone(zoneId) {
    return CONFIG.defaultFacility.zones.find(z => z.id === zoneId) || null;
  }
}

window.predictionEngine = new PredictionEngine();
