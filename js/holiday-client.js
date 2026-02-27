/**
 * holiday-client.js - 日本の祝日データ取得
 * データソース: https://holidays-jp.github.io/api/v1/date.json
 * APIキー不要・無料・全祝日対応
 */

class HolidayClient {
  constructor() {
    this._holidays = null; // Map<'YYYY-MM-DD', '祝日名'>
    this._lastFetched = 0;
    this.CACHE_TTL = 24 * 60 * 60 * 1000; // 24時間キャッシュ
  }

  /**
   * 祝日データを取得（キャッシュあり）
   */
  async fetchHolidays() {
    const cacheAge = Date.now() - this._lastFetched;
    if (this._holidays && cacheAge < this.CACHE_TTL) {
      return this._holidays;
    }

    try {
      const resp = await fetch('https://holidays-jp.github.io/api/v1/date.json');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      this._holidays = new Map(Object.entries(data));
      this._lastFetched = Date.now();
      console.log(`[HolidayClient] ${this._holidays.size}件の祝日データを取得完了`);
    } catch (e) {
      console.warn('[HolidayClient] 祝日API取得失敗（オフライン動作）:', e.message);
      if (!this._holidays) {
        // フォールバック：主要な固定祝日
        this._holidays = this._getBuiltinHolidays();
        console.log(`[HolidayClient] 内蔵祝日データ使用: ${this._holidays.size}件`);
      }
    }
    return this._holidays;
  }

  /**
   * 指定日が祝日かどうか
   * @param {string} dateStr - 'YYYY-MM-DD'
   */
  isHoliday(dateStr) {
    if (!this._holidays) return false;
    return this._holidays.has(dateStr);
  }

  /**
   * 祝日名を取得
   * @param {string} dateStr - 'YYYY-MM-DD'
   */
  getHolidayName(dateStr) {
    if (!this._holidays) return null;
    return this._holidays.get(dateStr) || null;
  }

  isLoaded() {
    return this._holidays !== null;
  }

  /** APIが使えない場合の内蔵祝日データ（2024〜2026年） */
  _getBuiltinHolidays() {
    const holidays = {
      // 2025
      '2025-01-01': '元日', '2025-01-13': '成人の日', '2025-02-11': '建国記念の日',
      '2025-02-23': '天皇誕生日', '2025-03-20': '春分の日', '2025-04-29': '昭和の日',
      '2025-05-03': '憲法記念日', '2025-05-04': 'みどりの日', '2025-05-05': 'こどもの日',
      '2025-07-21': '海の日', '2025-08-11': '山の日', '2025-09-15': '敬老の日',
      '2025-09-23': '秋分の日', '2025-10-13': 'スポーツの日', '2025-11-03': '文化の日',
      '2025-11-23': '勤労感謝の日', '2025-11-24': '振替休日',
      // 2026
      '2026-01-01': '元日', '2026-01-12': '成人の日', '2026-02-11': '建国記念の日',
      '2026-02-23': '天皇誕生日', '2026-03-20': '春分の日', '2026-04-29': '昭和の日',
      '2026-05-03': '憲法記念日', '2026-05-04': 'みどりの日', '2026-05-05': 'こどもの日',
      '2026-07-20': '海の日', '2026-08-11': '山の日', '2026-09-21': '敬老の日',
      '2026-09-23': '秋分の日', '2026-10-12': 'スポーツの日', '2026-11-03': '文化の日',
      '2026-11-23': '勤労感謝の日',
    };
    return new Map(Object.entries(holidays));
  }
}

window.holidayClient = new HolidayClient();
