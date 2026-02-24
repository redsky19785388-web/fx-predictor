/**
 * event-manager.js - 周辺イベント情報管理
 * 初期実装はモックデータ。実運用はTicketmaster/Peatix API等と連携可能。
 */

class EventManager {
  constructor() {
    this.EVENTS_KEY = 'crowdsense_events';
    this._events = null;
  }

  init() {
    this._events = this._loadEvents();
    if (this._events.length === 0) {
      // デフォルトのサンプルイベントを設定
      this._events = this._generateSampleEvents();
      this._saveEvents();
    }
    console.log(`[EventManager] ${this._events.length}件のイベントを読み込みました`);
  }

  _loadEvents() {
    const raw = localStorage.getItem(this.EVENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  }

  _saveEvents() {
    localStorage.setItem(this.EVENTS_KEY, JSON.stringify(this._events));
  }

  /**
   * サンプルイベントを生成（今後7日間のもの）
   */
  _generateSampleEvents() {
    const events = [];
    const now = Date.now();
    const baseDate = new Date();
    baseDate.setHours(0, 0, 0, 0);

    const sampleEvents = [
      {
        name: '年末大セール',
        description: 'モール全館でのビッグセールイベント',
        type: 'sale',
        size: 'large',
        impact: 1.60,
        daysFromNow: 1,
        durationDays: 2,
        startHour: 10,
        endHour: 22,
        radiusKm: 0.5
      },
      {
        name: '地域フリーマーケット',
        description: '近隣広場での地域イベント',
        type: 'community',
        size: 'medium',
        impact: 1.25,
        daysFromNow: 3,
        durationDays: 1,
        startHour: 9,
        endHour: 17,
        radiusKm: 0.3
      },
      {
        name: 'ポップアップショップ',
        description: '期間限定ショップオープン',
        type: 'pop_up',
        size: 'small',
        impact: 1.15,
        daysFromNow: 5,
        durationDays: 3,
        startHour: 11,
        endHour: 20,
        radiusKm: 0.1
      },
      {
        name: '近隣スタジアムライブ',
        description: '500m先スタジアムでの音楽ライブ',
        type: 'concert',
        size: 'large',
        impact: 1.45,
        daysFromNow: 7,
        durationDays: 1,
        startHour: 15,
        endHour: 22,
        radiusKm: 0.8
      },
    ];

    for (const tmpl of sampleEvents) {
      const eventDate = new Date(baseDate.getTime() + tmpl.daysFromNow * 24 * 60 * 60 * 1000);
      const startTs = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate(), tmpl.startHour).getTime();
      const endTs = new Date(
        eventDate.getFullYear(), eventDate.getMonth(),
        eventDate.getDate() + tmpl.durationDays - 1,
        tmpl.endHour
      ).getTime();

      events.push({
        id: `evt_${Math.random().toString(36).substr(2, 8)}`,
        name: tmpl.name,
        description: tmpl.description,
        type: tmpl.type,
        size: tmpl.size,
        impact: tmpl.impact,
        startTs,
        endTs,
        radiusKm: tmpl.radiusKm,
        lat: CONFIG.defaultFacility.lat + (Math.random() - 0.5) * 0.01,
        lng: CONFIG.defaultFacility.lng + (Math.random() - 0.5) * 0.01,
        createdAt: now
      });
    }

    return events;
  }

  /**
   * 特定日時・地点の周辺イベントを取得
   * @param {number} timestamp
   * @param {number} lat - 施設緯度
   * @param {number} lng - 施設経度
   * @param {number} radiusKm - 検索半径(km)
   */
  getEventsForDatetime(timestamp, lat, lng, radiusKm = 2.0) {
    return this._events.filter(evt => {
      // 時間帯が重なるか
      const timeOverlap = timestamp >= evt.startTs && timestamp <= evt.endTs;
      if (!timeOverlap) return false;
      // 距離チェック
      const dist = this._haversineKm(lat, lng, evt.lat, evt.lng);
      return dist <= radiusKm;
    });
  }

  /**
   * 今後7日間のイベント（ダッシュボード表示用）
   */
  getUpcomingEvents(days = 7) {
    const now = Date.now();
    const cutoff = now + days * 24 * 60 * 60 * 1000;
    return this._events
      .filter(e => e.endTs > now && e.startTs < cutoff)
      .sort((a, b) => a.startTs - b.startTs);
  }

  /**
   * イベント影響係数を算出
   * @param {Array} events
   * @param {string} zoneType
   */
  getEventModifier(events, zoneType = 'retail') {
    if (!events || events.length === 0) return 1.0;

    // 複数イベントは最大のものを採用（掛け合わせ不可）
    let maxImpact = 1.0;
    for (const evt of events) {
      let impact = evt.impact;
      // ゾーンタイプによる補正
      if (evt.type === 'sale' && zoneType === 'checkout') impact *= 1.2;
      if (evt.type === 'concert' && zoneType === 'food_court') impact *= 1.3;
      if (evt.type === 'sale' && zoneType === 'entrance') impact *= 1.1;
      maxImpact = Math.max(maxImpact, impact);
    }
    return Math.min(2.5, maxImpact);
  }

  /**
   * イベントを手動追加
   */
  addEvent(event) {
    const newEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      ...event,
      createdAt: Date.now()
    };
    this._events.push(newEvent);
    this._saveEvents();
    return newEvent;
  }

  deleteEvent(eventId) {
    this._events = this._events.filter(e => e.id !== eventId);
    this._saveEvents();
  }

  /**
   * Haversine公式による距離計算（km）
   */
  _haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  getEventTypeIcon(type) {
    const icons = {
      sale: '🏷️', concert: '🎵', community: '🏘️', pop_up: '🛍️',
      festival: '🎉', sport: '⚽', food: '🍜', art: '🎨'
    };
    return icons[type] || '📅';
  }

  getEventSizeLabel(size) {
    return { large: '大型', medium: '中型', small: '小型' }[size] || '不明';
  }
}

window.eventManager = new EventManager();
