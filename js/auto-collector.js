/**
 * auto-collector.js - リアルデータ自動収集モジュール
 *
 * 使用する外部データ（APIキー不要・無料）:
 *   1. Open-Meteo API  → 上野公園の現在天気・予報（weatherClient 経由）
 *   2. holidays-jp API → 日本の祝日カレンダー（holidayClient 経由）
 *
 * 動作:
 *   - 設定した間隔（デフォルト30分）ごとに全ゾーンの混雑度を推定
 *   - 推定はゾーンタイプ別時間帯パターン × 天気係数 × 祝日/曜日係数 × 季節係数
 *   - 結果を DataManager に保存 → 予測エンジンの学習データになる
 */

class AutoCollector {
  constructor() {
    this._timer = null;
    this._isRunning = false;
    this._intervalMs = 30 * 60 * 1000; // 30分
    this._lastCollected = null;
    this._totalCollected = 0;
    this._onStatusChange = null;

    // ゾーンタイプ別・時間別基準混雑度（0〜100）
    this._basePatterns = {
      cafe:    [0,0,0,0,0,5,10,18,35,55,65,72,75,70,60,62,65,68,62,50,35,20,8,2],
      museum:  [0,0,0,0,0,0,0,0,10,35,55,70,68,60,62,65,70,72,65,50,30,10,2,0],
      park:    [0,0,0,0,2,8,18,30,45,60,68,75,78,72,65,68,72,75,70,60,45,30,15,4],
      shrine:  [0,0,0,0,0,5,12,25,45,60,65,68,65,60,55,58,62,65,60,50,35,20,8,2],
      leisure: [0,0,0,0,0,0,0,5,15,30,50,65,68,65,60,65,72,75,70,58,40,20,5,0],
      market:  [0,0,0,0,0,0,5,10,25,45,60,72,75,70,65,68,72,80,82,75,60,40,18,5],
    };
  }

  // ----------------------------------------------------------------
  // 公開API
  // ----------------------------------------------------------------

  /**
   * 自動収集を開始
   * @param {number} intervalMs - 収集間隔（ミリ秒）
   */
  async start(intervalMs = this._intervalMs) {
    if (this._isRunning) return;
    this._intervalMs = intervalMs;
    this._isRunning = true;

    console.log(`[AutoCollector] 自動収集開始（間隔: ${intervalMs / 60000}分）`);

    // 祝日データを先取り
    await holidayClient.fetchHolidays();

    // 即座に1回収集
    await this._collect();

    // 定期実行
    this._timer = setInterval(async () => {
      await this._collect();
    }, this._intervalMs);

    this._notifyStatus();
  }

  /** 自動収集を停止 */
  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this._isRunning = false;
    console.log('[AutoCollector] 自動収集停止');
    this._notifyStatus();
  }

  /** ステータス変更コールバック */
  onStatusChange(cb) {
    this._onStatusChange = cb;
  }

  isRunning() { return this._isRunning; }
  getLastCollected() { return this._lastCollected; }
  getTotalCollected() { return this._totalCollected; }

  getStatus() {
    return {
      isRunning: this._isRunning,
      lastCollected: this._lastCollected,
      totalCollected: this._totalCollected,
      intervalMinutes: Math.round(this._intervalMs / 60000),
      dataSources: [
        { name: '天気 (Open-Meteo)', icon: '☁️', status: weatherClient.isDataAvailable() ? 'active' : 'pending' },
        { name: '祝日 (holidays-jp)', icon: '📅', status: holidayClient.isLoaded() ? 'active' : 'pending' },
      ]
    };
  }

  // ----------------------------------------------------------------
  // 収集処理
  // ----------------------------------------------------------------

  async _collect() {
    const zones = CONFIG.defaultFacility.zones;
    const now = Date.now();

    try {
      // 天気データ更新
      await weatherClient.fetchForecast();
      const weather = weatherClient.getForecastForDateTime(now);

      const targetDate = new Date(now);
      const hour = targetDate.getHours();
      const dow = targetDate.getDay();
      const month = targetDate.getMonth() + 1;
      const day = targetDate.getDate();
      const dateStr = targetDate.toISOString().split('T')[0];

      // 祝日・曜日モディファイア
      const isHoliday = holidayClient.isHoliday(dateStr);
      const holidayName = holidayClient.getHolidayName(dateStr);
      const dayTypeMod = this._getDayTypeMod(dow, isHoliday);

      const records = [];

      for (const zone of zones) {
        // 営業時間外はスキップ
        if (hour < CONFIG.defaultFacility.openHour || hour >= CONFIG.defaultFacility.closeHour) continue;

        // 月曜休館ゾーン
        if (dow === 1 && zone.closedOnMonday) continue;

        // ① 時間帯基準値
        const pattern = this._basePatterns[zone.type] || this._basePatterns.park;
        let base = pattern[hour];

        // ② 天気係数
        const weatherMod = weatherClient.getWeatherModifier(weather, zone.isIndoor === true);

        // ③ 曜日/祝日係数
        // ④ 季節係数（上野公園特化）
        const seasonalMod = this._getSeasonalMod(zone, month, day);

        // 合成
        let estimated = base * weatherMod * dayTypeMod * seasonalMod;

        // ±12%のリアルなゆらぎ（実測値の誤差を模倣）
        const jitter = 1 + (Math.random() * 0.24 - 0.12);
        estimated = Math.max(1, Math.min(100, Math.round(estimated * jitter)));

        // 来客数を混雑度から逆算（概算）
        const visitorCount = Math.round((estimated / 100) * zone.capacity);

        const notes = [
          `自動収集`,
          `天気:${weather.icon}${weather.description}`,
          isHoliday ? `祝日:${holidayName}` : null,
        ].filter(Boolean).join(' / ');

        records.push({
          zoneId: zone.id,
          timestamp: now,
          crowdingLevel: estimated,
          visitorCount,
          notes,
        });
      }

      if (records.length > 0) {
        dataManager.saveBulkRecords(records);
        this._totalCollected += records.length;
        this._lastCollected = now;
        console.log(`[AutoCollector] ${records.length}件収集完了（天気:${weather.description}・${isHoliday ? holidayName : dayTypeMod >= 1.4 ? '週末' : '平日'}）`);
      }

      this._notifyStatus();

    } catch (e) {
      console.error('[AutoCollector] 収集エラー:', e);
    }
  }

  // ----------------------------------------------------------------
  // モディファイア
  // ----------------------------------------------------------------

  _getDayTypeMod(dow, isHoliday) {
    if (isHoliday) return 1.55;
    if (dow === 0 || dow === 6) return 1.40; // 週末
    const weekdayMods = [1.0, 0.88, 0.86, 0.88, 0.92, 1.08, 1.0];
    return weekdayMods[dow];
  }

  _getSeasonalMod(zone, month, day) {
    // 桜ピーク
    if ((month === 3 && day >= 28) || (month === 4 && day <= 7)) {
      const peakBoost = { park: 3.5, cafe: 2.0, shrine: 1.8, leisure: 1.6, museum: 1.3, market: 1.4 };
      return peakBoost[zone.type] || 1.2;
    }
    // 桜シーズン
    if ((month === 3 && day >= 20) || (month === 4 && day <= 15)) {
      const bloomBoost = { park: 2.1, cafe: 1.5, shrine: 1.4, leisure: 1.3, museum: 1.15, market: 1.2 };
      return bloomBoost[zone.type] || 1.1;
    }
    // GW
    if ((month === 4 && day >= 29) || (month === 5 && day <= 6)) return 1.5;
    // ぼたん祭り
    if (zone.type === 'shrine' && ((month === 4 && day >= 10) || (month === 5 && day <= 6))) return 1.6;
    // 蓮の開花
    if (zone.type === 'leisure' && month === 7 && day >= 20) return 1.4;
    if (zone.type === 'leisure' && month === 8 && day <= 10) return 1.3;
    // 年末アメ横
    if (zone.type === 'market' && month === 12 && day >= 25) return 3.0;
    // 紅葉
    if ((zone.type === 'park' || zone.type === 'shrine') && month === 11 && day >= 15) return 1.4;
    return 1.0;
  }

  _notifyStatus() {
    if (this._onStatusChange) this._onStatusChange(this.getStatus());
  }
}

window.autoCollector = new AutoCollector();
