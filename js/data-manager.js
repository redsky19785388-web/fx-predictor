/**
 * data-manager.js - 混雑データの永続化管理（localStorage）
 * マイクロロケーション混雑予測AIシステム
 */

class DataManager {
  constructor() {
    this.RECORDS_KEY = 'crowdsense_records';
    this.SETTINGS_KEY = 'crowdsense_settings';
    this.ALERTS_KEY = 'crowdsense_alerts';
    this._cache = null;
  }

  // -------- 初期化 --------

  init() {
    if (!localStorage.getItem(this.RECORDS_KEY)) {
      localStorage.setItem(this.RECORDS_KEY, JSON.stringify([]));
    }
    if (!localStorage.getItem(this.ALERTS_KEY)) {
      localStorage.setItem(this.ALERTS_KEY, JSON.stringify([]));
    }
    this._cache = null;
    console.log('[DataManager] 初期化完了。レコード数:', this._getAllRecords().length);
  }

  // -------- 設定管理 --------

  getSettings() {
    const raw = localStorage.getItem(this.SETTINGS_KEY);
    return raw ? JSON.parse(raw) : {};
  }

  saveSettings(settings) {
    const current = this.getSettings();
    localStorage.setItem(this.SETTINGS_KEY, JSON.stringify({ ...current, ...settings }));
  }

  // -------- レコード管理（混雑データ）--------

  _getAllRecords() {
    if (this._cache) return this._cache;
    const raw = localStorage.getItem(this.RECORDS_KEY);
    this._cache = raw ? JSON.parse(raw) : [];
    return this._cache;
  }

  _saveAllRecords(records) {
    this._cache = records;
    localStorage.setItem(this.RECORDS_KEY, JSON.stringify(records));
  }

  /**
   * 混雑レコードを保存
   * @param {Object} record - { zoneId, timestamp, crowdingLevel, visitorCount?, notes? }
   */
  saveRecord(record) {
    const records = this._getAllRecords();
    const newRecord = {
      id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      zoneId: record.zoneId,
      timestamp: record.timestamp || Date.now(),
      crowdingLevel: Math.max(0, Math.min(100, Math.round(record.crowdingLevel))),
      visitorCount: record.visitorCount || null,
      notes: record.notes || '',
      createdAt: Date.now()
    };
    records.push(newRecord);
    this._saveAllRecords(records);
    return newRecord;
  }

  /**
   * バルクインサート（ダミーデータ生成用）
   * @param {Array} recordArray
   */
  saveBulkRecords(recordArray) {
    const records = this._getAllRecords();
    const now = Date.now();
    const newRecords = recordArray.map((r, i) => ({
      id: `rec_${now}_${i}`,
      zoneId: r.zoneId,
      timestamp: r.timestamp,
      crowdingLevel: Math.max(0, Math.min(100, Math.round(r.crowdingLevel))),
      visitorCount: r.visitorCount || null,
      notes: r.notes || '',
      createdAt: now
    }));
    const merged = records.concat(newRecords);
    this._saveAllRecords(merged);
    return newRecords.length;
  }

  /**
   * ゾーン・期間でレコードを取得
   */
  getRecords({ zoneId = null, startTime = null, endTime = null, limit = 1000 } = {}) {
    let records = this._getAllRecords();
    if (zoneId) records = records.filter(r => r.zoneId === zoneId);
    if (startTime) records = records.filter(r => r.timestamp >= startTime);
    if (endTime) records = records.filter(r => r.timestamp <= endTime);
    // 新しい順にソート
    records.sort((a, b) => b.timestamp - a.timestamp);
    return records.slice(0, limit);
  }

  /**
   * 最新の混雑レベルを取得（各ゾーン）
   */
  getLatestCrowdingByZone() {
    const records = this._getAllRecords();
    const latest = {};
    for (const r of records) {
      if (!latest[r.zoneId] || r.timestamp > latest[r.zoneId].timestamp) {
        latest[r.zoneId] = r;
      }
    }
    return latest;
  }

  /**
   * 特定ゾーン・曜日・時間帯の過去データを取得（予測エンジン用）
   * @param {string} zoneId
   * @param {number} dayOfWeek - 0(日)〜6(土)
   * @param {number} hour - 0〜23
   * @param {number} weeksBack - 何週分遡るか
   */
  getHistoricalPattern(zoneId, dayOfWeek, hour, weeksBack = 8) {
    const cutoff = Date.now() - (weeksBack * 7 * 24 * 60 * 60 * 1000);
    const records = this._getAllRecords().filter(r => {
      if (r.zoneId !== zoneId) return false;
      if (r.timestamp < cutoff) return false;
      const d = new Date(r.timestamp);
      return d.getDay() === dayOfWeek && d.getHours() === hour;
    });
    return records;
  }

  /**
   * 特定ゾーンの当日データを取得
   */
  getTodayData(zoneId) {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000;
    return this.getRecords({ zoneId, startTime: startOfDay, endTime: endOfDay, limit: 100 });
  }

  /**
   * 全ゾーンの統計情報
   */
  getStats() {
    const records = this._getAllRecords();
    if (records.length === 0) return { total: 0, zones: {} };

    const zoneStats = {};
    for (const r of records) {
      if (!zoneStats[r.zoneId]) {
        zoneStats[r.zoneId] = { count: 0, avgLevel: 0, minLevel: 100, maxLevel: 0, levels: [] };
      }
      const s = zoneStats[r.zoneId];
      s.count++;
      s.levels.push(r.crowdingLevel);
      s.minLevel = Math.min(s.minLevel, r.crowdingLevel);
      s.maxLevel = Math.max(s.maxLevel, r.crowdingLevel);
    }

    for (const zoneId in zoneStats) {
      const s = zoneStats[zoneId];
      s.avgLevel = Math.round(s.levels.reduce((a, b) => a + b, 0) / s.levels.length);
      delete s.levels;
    }

    const dates = records.map(r => r.timestamp);
    return {
      total: records.length,
      oldestRecord: Math.min(...dates),
      newestRecord: Math.max(...dates),
      zones: zoneStats
    };
  }

  /**
   * 全データ削除
   */
  deleteAllRecords() {
    this._cache = [];
    localStorage.setItem(this.RECORDS_KEY, JSON.stringify([]));
    console.log('[DataManager] 全レコード削除完了');
  }

  /**
   * JSONエクスポート
   */
  exportData() {
    const data = {
      exportedAt: new Date().toISOString(),
      version: CONFIG.version,
      records: this._getAllRecords()
    };
    return JSON.stringify(data, null, 2);
  }

  /**
   * JSONインポート
   */
  importData(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (!data.records || !Array.isArray(data.records)) throw new Error('不正なフォーマット');
      this._saveAllRecords(data.records);
      return data.records.length;
    } catch (e) {
      console.error('[DataManager] インポートエラー:', e);
      throw e;
    }
  }

  // -------- アラート管理 --------

  getAlerts() {
    const raw = localStorage.getItem(this.ALERTS_KEY);
    return raw ? JSON.parse(raw) : [];
  }

  saveAlerts(alerts) {
    localStorage.setItem(this.ALERTS_KEY, JSON.stringify(alerts));
  }

  addAlert(alert) {
    const alerts = this.getAlerts();
    const newAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      ...alert,
      createdAt: Date.now(),
      isRead: false
    };
    alerts.unshift(newAlert);
    // 最新100件のみ保持
    this.saveAlerts(alerts.slice(0, 100));
    return newAlert;
  }

  markAlertsAsRead(ids = null) {
    const alerts = this.getAlerts();
    for (const alert of alerts) {
      if (!ids || ids.includes(alert.id)) {
        alert.isRead = true;
      }
    }
    this.saveAlerts(alerts);
  }

  getUnreadAlertCount() {
    return this.getAlerts().filter(a => !a.isRead).length;
  }

  clearOldAlerts(daysOld = 7) {
    const cutoff = Date.now() - daysOld * 24 * 60 * 60 * 1000;
    const alerts = this.getAlerts().filter(a => a.createdAt >= cutoff);
    this.saveAlerts(alerts);
  }
}

window.dataManager = new DataManager();
