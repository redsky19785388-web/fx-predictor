/**
 * event-manager.js - 上野公園ローカルイベント手動管理システム v2.0
 * 店舗管理者がダッシュボードから直接イベントを登録・編集・削除できるCRUDシステム
 */

class EventManager {
  constructor() {
    this.EVENTS_KEY = 'crowdsense_ueno_events_v2';
    this._events = null;
  }
}

EventManager.EVENT_TYPES = [
  { id: 'cherry_blossom', label: '🌸 桜・お花見情報',      defaultImpact: 2.0 },
  { id: 'exhibition',     label: '🎨 展覧会・特別展',       defaultImpact: 1.4 },
  { id: 'festival',       label: '🎉 祭り・フェスティバル',  defaultImpact: 1.6 },
  { id: 'fireworks',      label: '🎆 花火大会',             defaultImpact: 1.8 },
  { id: 'concert',        label: '🎵 コンサート・音楽',      defaultImpact: 1.5 },
  { id: 'school',         label: '🏫 学校行事・遠足',        defaultImpact: 1.3 },
  { id: 'holiday',        label: '🎌 祝日・連休',           defaultImpact: 1.4 },
  { id: 'sale',           label: '📢 セール・キャンペーン',  defaultImpact: 1.3 },
  { id: 'sports',         label: '⚽ スポーツイベント',      defaultImpact: 1.2 },
  { id: 'other',          label: '📅 その他',               defaultImpact: 1.2 }
];

EventManager.prototype = {
  constructor: EventManager,

  init() {
    this._events = this._loadEvents();
    if (this._events.length === 0) {
      this._events = this._generateSampleUenoEvents();
      this._saveEvents();
    }
    console.log(`[EventManager] ${this._events.length}件のイベントを読み込みました`);
  },

  _loadEvents() {
    try {
      const raw = localStorage.getItem(this.EVENTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch(e) { return []; }
  },

  _saveEvents() {
    localStorage.setItem(this.EVENTS_KEY, JSON.stringify(this._events));
  },

  // ----------------------------------------------------------------
  // サンプルイベント生成
  // ----------------------------------------------------------------
  _generateSampleUenoEvents() {
    const year = new Date().getFullYear();
    const mk = (name, description, type, affectedZones, impact, startDate, endDate, sh, eh) => ({
      id: `evt_${Math.random().toString(36).substr(2,8)}`,
      name, description, type, affectedZones, impact,
      startTs: new Date(`${startDate}T${String(sh).padStart(2,'0')}:00:00`).getTime(),
      endTs:   new Date(`${endDate}T${String(eh).padStart(2,'0')}:00:00`).getTime(),
      createdAt: Date.now()
    });

    return [
      mk(
        '東京都美術館 特別展「印象派の巨匠たち」',
        '毎年恒例の大型企画展。入場者が周辺カフェ・通路に波及します。',
        'exhibition',
        ['zone_art_museum','zone_zoo_cafe'],
        1.45,
        `${year}-03-15`, `${year}-06-30`, 9, 18
      ),
      mk(
        '上野恩賜公園 桜まつり',
        '例年3月下旬〜4月上旬が見頃。公園全体で極端な混雑が予想されます。',
        'cherry_blossom',
        ['zone_sakura_path','zone_zoo_cafe','zone_shinobazu_boat','zone_toshogu'],
        2.5,
        `${year}-03-25`, `${year}-04-10`, 6, 21
      ),
      mk(
        '上野東照宮 ぼたん祭り',
        '春のぼたん苑開園。境内・周辺参道への参拝客が増加します。',
        'festival',
        ['zone_toshogu','zone_zoo_cafe'],
        1.6,
        `${year}-04-10`, `${year}-05-06`, 9, 17
      ),
      mk(
        '上野動物園 GW特別開園',
        'GW中は入園者数が通常比180%。カフェ・博物館周辺も大混雑します。',
        'holiday',
        ['zone_zoo_cafe','zone_sakura_path','zone_national_museum'],
        1.8,
        `${year}-04-29`, `${year}-05-06`, 9, 17
      )
    ].filter(e => !isNaN(e.startTs) && !isNaN(e.endTs));
  },

  // ----------------------------------------------------------------
  // CRUD
  // ----------------------------------------------------------------
  getAllEvents() {
    return [...this._events].sort((a,b) => a.startTs - b.startTs);
  },

  addEvent(eventData) {
    const ev = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2,6)}`,
      name:          eventData.name,
      description:   eventData.description || '',
      type:          eventData.type || 'other',
      affectedZones: Array.isArray(eventData.affectedZones) ? eventData.affectedZones : [],
      impact:        parseFloat(eventData.impact) || 1.2,
      startTs:       eventData.startTs,
      endTs:         eventData.endTs,
      createdAt:     Date.now()
    };
    this._events.push(ev);
    this._saveEvents();
    return ev;
  },

  editEvent(eventId, updates) {
    const idx = this._events.findIndex(e => e.id === eventId);
    if (idx === -1) return null;
    this._events[idx] = { ...this._events[idx], ...updates, updatedAt: Date.now() };
    this._saveEvents();
    return this._events[idx];
  },

  deleteEvent(eventId) {
    const before = this._events.length;
    this._events = this._events.filter(e => e.id !== eventId);
    if (this._events.length < before) { this._saveEvents(); return true; }
    return false;
  },

  getEventById(id) {
    return this._events.find(e => e.id === id) || null;
  },

  // ----------------------------------------------------------------
  // Query
  // ----------------------------------------------------------------
  /** 特定日時・ゾーンに関連するイベントを取得 */
  getEventsForDatetime(timestamp, zoneId = null) {
    return this._events.filter(evt => {
      if (timestamp < evt.startTs || timestamp > evt.endTs) return false;
      if (zoneId && evt.affectedZones.length > 0) {
        return evt.affectedZones.includes(zoneId);
      }
      return true;
    });
  },

  /** 今後n日間のイベント */
  getUpcomingEvents(days = 14) {
    const now = Date.now();
    const cutoff = now + days * 24 * 60 * 60 * 1000;
    return this._events
      .filter(e => e.endTs > now && e.startTs < cutoff)
      .sort((a,b) => a.startTs - b.startTs);
  },

  /** イベント影響係数（ゾーン考慮） */
  getEventModifier(events, zoneId = null) {
    if (!events || events.length === 0) return 1.0;
    let maxImpact = 1.0;
    for (const evt of events) {
      let impact = evt.impact || 1.2;
      if (zoneId && evt.affectedZones && evt.affectedZones.includes(zoneId)) {
        impact *= 1.05; // 直接影響ゾーンは5%増
      }
      maxImpact = Math.max(maxImpact, impact);
    }
    return Math.min(3.5, maxImpact);
  },

  // ----------------------------------------------------------------
  // UI Helpers
  // ----------------------------------------------------------------
  getEventTypeIcon(type) {
    const icons = {
      cherry_blossom: '🌸', exhibition: '🎨', festival: '🎉',
      fireworks: '🎆', concert: '🎵', school: '🏫',
      holiday: '🎌', sale: '📢', sports: '⚽', other: '📅'
    };
    return icons[type] || '📅';
  },

  getEventTypeLabel(type) {
    const t = EventManager.EVENT_TYPES.find(t => t.id === type);
    return t ? t.label : '不明';
  },

  /** イベントのサイズラベル（互換性のため残す） */
  getEventSizeLabel(size) {
    return { large: '大型', medium: '中型', small: '小型' }[size] || '';
  },

  // ----------------------------------------------------------------
  // フォーム描画
  // ----------------------------------------------------------------
  renderEventRegistrationForm(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const zoneOptions = (CONFIG.defaultFacility.zones || []).map(z =>
      `<label class="checkbox-label zone-check">
        <input type="checkbox" name="affectedZones" value="${z.id}">
        <span class="zone-dot" style="background:${z.color}"></span>
        <span>${z.name}</span>
      </label>`
    ).join('');

    const typeOptions = EventManager.EVENT_TYPES.map(t =>
      `<option value="${t.id}" data-impact="${t.defaultImpact}">${t.label}</option>`
    ).join('');

    container.innerHTML = `
      <form id="event-entry-form" class="data-form event-entry-form">
        <input type="hidden" id="event-edit-id" value="">
        <div class="form-group">
          <label>イベント名 <span class="required-mark">*</span></label>
          <input type="text" id="event-name" class="form-control"
                 placeholder="例: 東京都美術館 モネ展 / 桜まつり" required>
        </div>
        <div class="form-group">
          <label>カテゴリ <span class="required-mark">*</span></label>
          <select id="event-type" class="form-control" required>${typeOptions}</select>
        </div>
        <div class="form-group">
          <label>説明（任意）</label>
          <textarea id="event-description" class="form-control" rows="2"
                    placeholder="来客への影響や特記事項"></textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>開始日時 <span class="required-mark">*</span></label>
            <input type="datetime-local" id="event-start" class="form-control" required>
          </div>
          <div class="form-group">
            <label>終了日時 <span class="required-mark">*</span></label>
            <input type="datetime-local" id="event-end" class="form-control" required>
          </div>
        </div>
        <div class="form-group">
          <label>来客増加係数（×1.0〜×3.5）</label>
          <div class="impact-control">
            <input type="range" id="event-impact" class="range-input"
                   min="1.0" max="3.5" step="0.05" value="1.3">
            <span id="event-impact-value" class="impact-value">×1.30（+30%増）</span>
          </div>
        </div>
        <div class="form-group">
          <label>影響ゾーン（複数選択可・未選択=全体）</label>
          <div class="zone-checkboxes">${zoneOptions}</div>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn-primary" id="btn-event-submit">📅 登録する</button>
          <button type="button" class="btn-secondary" id="btn-event-cancel"
                  style="display:none">キャンセル</button>
        </div>
      </form>`;

    this._bindFormEvents();
  },

  _bindFormEvents() {
    // Impact スライダー
    const slider = document.getElementById('event-impact');
    const valEl  = document.getElementById('event-impact-value');
    if (slider && valEl) {
      slider.addEventListener('input', () => {
        const v = parseFloat(slider.value);
        valEl.textContent = `×${v.toFixed(2)}（+${Math.round((v-1)*100)}%増）`;
      });
    }
    // カテゴリ変更でデフォルト係数を反映
    const typeEl = document.getElementById('event-type');
    if (typeEl && slider) {
      typeEl.addEventListener('change', () => {
        const opt = typeEl.options[typeEl.selectedIndex];
        const def = parseFloat(opt.dataset.impact) || 1.3;
        slider.value = def;
        slider.dispatchEvent(new Event('input'));
      });
    }
    // フォーム送信
    const form = document.getElementById('event-entry-form');
    if (form) form.addEventListener('submit', e => { e.preventDefault(); this._handleFormSubmit(); });
    // キャンセル
    const cancelBtn = document.getElementById('btn-event-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', () => this._resetForm());
  },

  _handleFormSubmit() {
    const editId = document.getElementById('event-edit-id')?.value;
    const name   = document.getElementById('event-name')?.value?.trim();
    const type   = document.getElementById('event-type')?.value;
    const desc   = document.getElementById('event-description')?.value?.trim();
    const sv     = document.getElementById('event-start')?.value;
    const ev2    = document.getElementById('event-end')?.value;
    const impact = parseFloat(document.getElementById('event-impact')?.value) || 1.3;

    if (!name || !sv || !ev2) { showToast('必須項目を入力してください', 'warning'); return; }
    const startTs = new Date(sv).getTime();
    const endTs   = new Date(ev2).getTime();
    if (endTs <= startTs) { showToast('終了日時は開始日時より後に設定してください', 'warning'); return; }

    const affectedZones = [];
    document.querySelectorAll('input[name="affectedZones"]:checked')
      .forEach(cb => affectedZones.push(cb.value));

    const data = { name, type, description: desc, startTs, endTs, impact, affectedZones };
    if (editId) {
      this.editEvent(editId, data);
      showToast(`「${name}」を更新しました`, 'success');
    } else {
      this.addEvent(data);
      showToast(`「${name}」を登録しました`, 'success');
    }
    this._resetForm();
    this.renderEventList('event-manage-list');
  },

  _resetForm() {
    const form = document.getElementById('event-entry-form');
    if (form) form.reset();
    const editId = document.getElementById('event-edit-id');
    if (editId) editId.value = '';
    const submitBtn = document.getElementById('btn-event-submit');
    if (submitBtn) submitBtn.textContent = '📅 登録する';
    const cancelBtn = document.getElementById('btn-event-cancel');
    if (cancelBtn) cancelBtn.style.display = 'none';
    const slider = document.getElementById('event-impact');
    const valEl  = document.getElementById('event-impact-value');
    if (slider && valEl) {
      slider.value = 1.3;
      valEl.textContent = '×1.30（+30%増）';
    }
  },

  startEdit(eventId) {
    const evt = this.getEventById(eventId);
    if (!evt) return;
    const toLocal = ts => {
      const d = new Date(ts);
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      return d.toISOString().slice(0,16);
    };
    document.getElementById('event-edit-id').value    = evt.id;
    document.getElementById('event-name').value       = evt.name;
    document.getElementById('event-type').value       = evt.type;
    document.getElementById('event-description').value= evt.description || '';
    document.getElementById('event-start').value      = toLocal(evt.startTs);
    document.getElementById('event-end').value        = toLocal(evt.endTs);
    const slider = document.getElementById('event-impact');
    if (slider) { slider.value = evt.impact; slider.dispatchEvent(new Event('input')); }
    document.querySelectorAll('input[name="affectedZones"]').forEach(cb => {
      cb.checked = evt.affectedZones.includes(cb.value);
    });
    const submitBtn = document.getElementById('btn-event-submit');
    if (submitBtn) submitBtn.textContent = '💾 更新する';
    const cancelBtn = document.getElementById('btn-event-cancel');
    if (cancelBtn) cancelBtn.style.display = 'inline-flex';
    document.getElementById('event-entry-form')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  // ----------------------------------------------------------------
  // イベント一覧描画
  // ----------------------------------------------------------------
  renderEventList(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const events = this.getAllEvents();
    if (events.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📅</div>
          <p>登録されたイベントはありません</p>
          <small>上のフォームからイベントを追加してください</small>
        </div>`;
      return;
    }

    const now = Date.now();
    container.innerHTML = events.map(evt => {
      const isActive  = now >= evt.startTs && now <= evt.endTs;
      const isPast    = now > evt.endTs;
      const statusCls = isActive ? 'active' : isPast ? 'past' : 'upcoming';
      const statusLbl = isActive ? '開催中' : isPast ? '終了' : '予定';
      const pct       = Math.round((evt.impact - 1) * 100);
      const zones     = (evt.affectedZones || []).map(zid => {
        const z = (CONFIG.defaultFacility.zones || []).find(z => z.id === zid);
        return z ? `<span class="zone-tag" style="border-color:${z.color};color:${z.color}">${z.name}</span>` : '';
      }).join('');
      const fmtTs = ts => new Date(ts).toLocaleString('ja-JP',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
      return `
        <div class="event-manage-item ${statusCls}" data-id="${evt.id}">
          <div class="event-manage-header">
            <span class="event-type-icon">${this.getEventTypeIcon(evt.type)}</span>
            <span class="event-manage-name">${evt.name}</span>
            <span class="event-status-badge ${statusCls}">${statusLbl}</span>
          </div>
          <div class="event-manage-dates">📅 ${fmtTs(evt.startTs)} 〜 ${fmtTs(evt.endTs)}</div>
          ${evt.description ? `<p class="event-manage-desc">${evt.description}</p>` : ''}
          ${zones ? `<div class="event-manage-zones">${zones}</div>` : ''}
          <div class="event-manage-footer">
            <span class="event-impact-badge">来客予測 +${pct}%</span>
            <div class="event-actions">
              <button class="btn-event-edit" onclick="eventManager.startEdit('${evt.id}')">✏️ 編集</button>
              <button class="btn-event-delete" onclick="eventManager._confirmDelete('${evt.id}')">🗑️ 削除</button>
            </div>
          </div>
        </div>`;
    }).join('');
  },

  _confirmDelete(eventId) {
    const evt = this.getEventById(eventId);
    if (!evt) return;
    if (!confirm(`「${evt.name}」を削除しますか？`)) return;
    this.deleteEvent(eventId);
    showToast('イベントを削除しました', 'info');
    this.renderEventList('event-manage-list');
  }
};

window.eventManager = new EventManager();
