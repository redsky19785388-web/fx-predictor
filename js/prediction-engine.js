/**
 * prediction-engine.js - 多変数混雑予測エンジン
 *
 * 予測式:
 *   predicted = base_historical × weather_modifier × event_modifier × day_type_modifier
 *
 * - base_historical: 過去同曜日・同時間帯データの加重平均
 * - weather_modifier: 天気（雨天/快晴/猛暑等）の影響係数
 * - event_modifier: 周辺イベントの影響係数
 * - day_type_modifier: 平日/週末/祝日の補正係数
 */

class PredictionEngine {
  constructor() {
    this.dataManager = null;
    this.weatherClient = null;
    this.eventManager = null;
    this._predictionCache = {};
    this._cacheExpiry = 10 * 60 * 1000; // 10分
  }

  init(dataManager, weatherClient, eventManager) {
    this.dataManager = dataManager;
    this.weatherClient = weatherClient;
    this.eventManager = eventManager;
    console.log('[PredictionEngine] 初期化完了');
  }

  /**
   * 特定ゾーン・日付の24時間分予測
   * @param {string} zoneId
   * @param {Date|number} targetDate - 予測対象日（当日開始時刻）
   * @returns {Array} 24要素の時間別予測配列
   */
  async predictDay(zoneId, targetDate) {
    const cacheKey = `${zoneId}_${new Date(targetDate).toDateString()}`;
    const cached = this._predictionCache[cacheKey];
    if (cached && Date.now() - cached.cachedAt < this._cacheExpiry) {
      return cached.data;
    }

    const zone = this._findZone(zoneId);
    if (!zone) return this._emptyPredictions(zoneId, targetDate);

    // 天気予報を事前取得
    await this.weatherClient.fetchForecast();

    const predictions = [];
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);

    for (let hour = 0; hour < 24; hour++) {
      const targetTs = dayStart.getTime() + hour * 60 * 60 * 1000;
      const pred = await this._predictHour(zone, targetTs);
      predictions.push(pred);
    }

    this._predictionCache[cacheKey] = { data: predictions, cachedAt: Date.now() };
    return predictions;
  }

  /**
   * 特定ゾーン・1時間の予測（コア計算）
   */
  async _predictHour(zone, targetTs) {
    const targetDate = new Date(targetTs);
    const dow = targetDate.getDay();
    const hour = targetDate.getHours();
    const isOpen = hour >= (CONFIG.defaultFacility.openHour || 9) &&
                   hour < (CONFIG.defaultFacility.closeHour || 22);

    if (!isOpen) {
      return this._makePrediction(zone.id, targetTs, 2, 0, {
        historicalBase: 2, weatherMod: 1, eventMod: 1, dayTypeMod: 1
      });
    }

    // 1. 過去データから基準値を計算
    const historicalData = this.dataManager.getHistoricalPattern(zone.id, dow, hour, 8);
    const { base, confidence } = this._calculateHistoricalBase(historicalData, zone, hour, dow);

    // 2. 天気モディファイア
    const weather = this.weatherClient.getForecastForDateTime(targetTs);
    const weatherMod = this.weatherClient.getWeatherModifier(weather, zone.isIndoor !== false);

    // 3. イベントモディファイア
    const facility = CONFIG.defaultFacility;
    const nearbyEvents = this.eventManager.getEventsForDatetime(targetTs, facility.lat, facility.lng, 2.0);
    const eventMod = this.eventManager.getEventModifier(nearbyEvents, zone.type);

    // 4. 曜日タイプモディファイア
    const dayTypeMod = this._getDayTypeModifier(targetDate);

    // 5. 複合予測
    let predicted = base * weatherMod * eventMod * dayTypeMod;
    predicted = Math.max(2, Math.min(100, Math.round(predicted)));

    return this._makePrediction(zone.id, targetTs, predicted, confidence, {
      historicalBase: Math.round(base),
      weatherMod: parseFloat(weatherMod.toFixed(2)),
      eventMod: parseFloat(eventMod.toFixed(2)),
      dayTypeMod: parseFloat(dayTypeMod.toFixed(2)),
      weatherInfo: weather,
      events: nearbyEvents.map(e => ({ name: e.name, impact: e.impact }))
    });
  }

  /**
   * 過去データから基準混雑値を計算（加重平均）
   * - 直近データに高い重みを付ける
   */
  _calculateHistoricalBase(historicalData, zone, hour, dow) {
    if (historicalData.length === 0) {
      // データなし → ゾーンタイプ別デフォルト値を使用
      return { base: this._getDefaultBase(zone.type, hour, dow), confidence: 0.3 };
    }

    // 直近データほど重み大（指数減衰）
    const now = Date.now();
    let weightedSum = 0;
    let weightTotal = 0;

    for (const record of historicalData) {
      const ageWeeks = (now - record.timestamp) / (7 * 24 * 60 * 60 * 1000);
      const weight = Math.exp(-0.3 * ageWeeks); // 減衰係数0.3
      weightedSum += record.crowdingLevel * weight;
      weightTotal += weight;
    }

    const base = weightedSum / weightTotal;
    // データ数が多いほど信頼度UP（最大0.95）
    const confidence = Math.min(0.95, 0.4 + historicalData.length * 0.055);

    return { base, confidence };
  }

  /**
   * データなしの場合のデフォルト基準値
   * ゾーンタイプ・時間帯・曜日から経験則的に計算
   */
  _getDefaultBase(zoneType, hour, dow) {
    const isWeekend = dow === 0 || dow === 6;
    const patterns = {
      entrance:   [3,3,3,3,3,3,3,5,20,40,55,70,68,60,62,68,72,75,70,60,45,25,10,4],
      food_court: [2,2,2,2,2,2,2,3,8,25,45,80,85,65,55,60,65,75,78,65,50,30,12,4],
      checkout:   [2,2,2,2,2,2,2,3,10,30,45,60,58,50,52,60,65,75,82,78,65,45,18,4],
      retail:     [2,2,2,2,2,2,2,3,12,35,52,65,62,58,62,68,72,78,80,72,58,38,15,4],
      service:    [2,2,2,2,2,2,2,3,15,40,52,55,50,52,55,58,55,50,48,42,35,22,10,3],
      rest:       [2,2,2,2,2,2,2,2,5,18,30,55,65,58,50,52,55,52,48,40,32,20,8,3],
    };
    const base = (patterns[zoneType] || patterns.retail)[hour];
    return isWeekend ? base * 1.35 : base;
  }

  /**
   * 曜日タイプモディファイア
   */
  _getDayTypeModifier(date) {
    const dow = date.getDay();
    const dateStr = date.toISOString().split('T')[0];

    // 祝日チェック
    const isHoliday = dummyGenerator && dummyGenerator.holidays && dummyGenerator.holidays.has(dateStr);
    if (isHoliday) return 1.50;

    const isWeekend = dow === 0 || dow === 6;
    if (isWeekend) return 1.35;

    // 平日でも曜日によって若干の差
    const weekdayMods = [1.0, 0.90, 0.88, 0.90, 0.95, 1.05, 1.0]; // 日〜土
    return weekdayMods[dow];
  }

  /**
   * 翌72時間の重要ポイント予測（ピーク・閑散検出）
   */
  async predictKeyPoints(zoneId) {
    const zone = this._findZone(zoneId);
    if (!zone) return [];

    await this.weatherClient.fetchForecast();

    const keyPoints = [];
    const now = Date.now();

    for (let hourOffset = 0; hourOffset < 72; hourOffset++) {
      const targetTs = now + hourOffset * 60 * 60 * 1000;
      const pred = await this._predictHour(zone, targetTs);

      if (pred.predictedLevel >= CONFIG.alerts.highCrowdingThreshold ||
          pred.predictedLevel <= CONFIG.alerts.lowCrowdingThreshold) {
        keyPoints.push(pred);
      }
    }

    return keyPoints;
  }

  /**
   * アクションレコメンデーションを生成
   * @param {Array} predictions - predictDay()の結果
   * @param {Object} zone
   */
  generateRecommendations(predictions, zone) {
    const recommendations = [];
    const settings = dataManager.getSettings();
    const highThreshold = settings.highCrowdingThreshold || CONFIG.alerts.highCrowdingThreshold;
    const lowThreshold = settings.lowCrowdingThreshold || CONFIG.alerts.lowCrowdingThreshold;

    for (const pred of predictions) {
      if (!pred || pred.predictedLevel === undefined) continue;
      const hour = new Date(pred.targetTs).getHours();

      if (pred.predictedLevel >= highThreshold) {
        recommendations.push({
          type: 'high_crowding',
          severity: pred.predictedLevel >= 90 ? 'critical' : 'high',
          time: pred.targetTs,
          zone: zone.name,
          message: `${zone.name}で${hour}時台に混雑ピーク（予測: ${pred.predictedLevel}%）が見込まれます。`,
          action: this._getHighCrowdingAction(pred, zone),
          factors: pred.factors
        });
      } else if (pred.predictedLevel <= lowThreshold) {
        recommendations.push({
          type: 'low_crowding',
          severity: 'info',
          time: pred.targetTs,
          zone: zone.name,
          message: `${zone.name}で${hour}時台に閑散（予測: ${pred.predictedLevel}%）が見込まれます。`,
          action: this._getLowCrowdingAction(pred, zone),
          factors: pred.factors
        });
      }
    }

    // 天気影響の特記事項
    const weatherAlerts = this._detectWeatherImpacts(predictions, zone);
    recommendations.push(...weatherAlerts);

    // 重複排除・時刻ソート
    return recommendations
      .filter((r, i, arr) => arr.findIndex(x => x.time === r.time && x.type === r.type) === i)
      .sort((a, b) => a.time - b.time)
      .slice(0, 10); // 最大10件
  }

  _getHighCrowdingAction(pred, zone) {
    const level = pred.predictedLevel;
    const hour = new Date(pred.targetTs).getHours();
    const actions = [];

    if (zone.type === 'checkout') {
      actions.push(`レジを${Math.ceil(level / 25)}レーン開放してください`);
    } else if (zone.type === 'food_court') {
      actions.push('キッチンスタッフを増員してください');
      if (level >= 85) actions.push('テイクアウト用の臨時レジを設置してください');
    } else if (zone.type === 'entrance') {
      actions.push('警備員・案内スタッフを追加配置してください');
    } else {
      actions.push(`スタッフを通常比${Math.round((level / 50) * 100)}%増員してください`);
    }

    if (pred.factors?.eventMod > 1.2) {
      actions.push(`周辺イベントによる集客増加のため、臨時体制を準備してください`);
    }
    if (pred.factors?.weatherMod > 1.1) {
      actions.push('悪天候による来店集中に備えてください');
    }

    return actions.join('。') + '。';
  }

  _getLowCrowdingAction(pred, zone) {
    const actions = [];
    const hour = new Date(pred.targetTs).getHours();

    actions.push(`この時間帯にスタッフの休憩・シフト調整を行うことを推奨します`);

    if (pred.factors?.weatherMod < 0.85) {
      const reduction = Math.round((1 - pred.factors.weatherMod) * 100);
      actions.push(`悪天候により客足が約${reduction}%減少する見込みです`);
    }

    if (zone.type === 'food_court' || zone.type === 'checkout') {
      actions.push('タイムセール・値引きキャンペーンで来客を促進することも有効です');
    }

    return actions.join('。') + '。';
  }

  _detectWeatherImpacts(predictions, zone) {
    const alerts = [];
    let maxWeatherImpact = { mod: 1.0, pred: null };

    for (const pred of predictions) {
      if (!pred?.factors) continue;
      const mod = pred.factors.weatherMod;
      if (Math.abs(1 - mod) > Math.abs(1 - maxWeatherImpact.mod)) {
        maxWeatherImpact = { mod, pred };
      }
    }

    const threshold = (CONFIG.alerts.weatherImpactThreshold || 20) / 100;
    if (maxWeatherImpact.mod && Math.abs(1 - maxWeatherImpact.mod) > threshold) {
      const pct = Math.round(Math.abs(1 - maxWeatherImpact.mod) * 100);
      const direction = maxWeatherImpact.mod > 1 ? '増加' : '減少';
      const weather = maxWeatherImpact.pred?.factors?.weatherInfo;
      alerts.push({
        type: 'weather_impact',
        severity: 'warning',
        time: maxWeatherImpact.pred?.targetTs || Date.now(),
        zone: zone.name,
        message: `天気の影響で${zone.name}の来客が最大${pct}%${direction}する見込みです。${weather?.description ? `（予報: ${weather.icon} ${weather.description}）` : ''}`,
        action: maxWeatherImpact.mod > 1
          ? '悪天候対策として館内案内・傘立てを充実させてください。'
          : 'スタッフシフトを削減し、人件費を最適化することを推奨します。',
        factors: maxWeatherImpact.pred?.factors || {}
      });
    }

    return alerts;
  }

  /**
   * ピーク時刻を検出
   */
  getPeakTime(predictions) {
    if (!predictions || predictions.length === 0) return null;
    const openHours = predictions.filter(p => {
      const h = new Date(p.targetTs).getHours();
      return h >= (CONFIG.defaultFacility.openHour || 9) && h < (CONFIG.defaultFacility.closeHour || 22);
    });
    if (openHours.length === 0) return null;
    return openHours.reduce((max, p) => p.predictedLevel > max.predictedLevel ? p : max);
  }

  /**
   * 信頼度バーのCSS幅（%）
   */
  getConfidencePercent(confidence) {
    return Math.round(confidence * 100);
  }

  _makePrediction(zoneId, targetTs, predictedLevel, confidence, factors) {
    return {
      zoneId,
      targetTs,
      predictedLevel,
      confidence: parseFloat(confidence.toFixed(2)),
      factors,
      generatedAt: Date.now()
    };
  }

  _emptyPredictions(zoneId, targetDate) {
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    return Array.from({ length: 24 }, (_, h) => ({
      zoneId,
      targetTs: dayStart.getTime() + h * 60 * 60 * 1000,
      predictedLevel: 0,
      confidence: 0,
      factors: {}
    }));
  }

  _findZone(zoneId) {
    return CONFIG.defaultFacility.zones.find(z => z.id === zoneId) || null;
  }

  clearCache() {
    this._predictionCache = {};
  }
}

window.predictionEngine = new PredictionEngine();
