/**
 * floor-plan.js - 施設内フロアプランSVGヒートマップレンダラー
 * 各ゾーンの混雑度に応じてカラーリングし、インタラクティブに表示
 */

class FloorPlan {
  constructor() {
    this.svgEl = null;
    this.zones = [];
    this.crowdingData = {}; // { zoneId: { level, trend } }
    this.selectedZoneId = null;
    this._onClickCallback = null;
    this._onHoverCallback = null;
    this.tooltip = null;
  }

  init(svgId, tooltipId, zones) {
    this.svgEl = document.getElementById(svgId);
    this.tooltip = document.getElementById(tooltipId);
    this.zones = zones;
    if (!this.svgEl) return;

    this._renderFloorPlan();
    this._bindTooltip();
    console.log('[FloorPlan] 初期化完了:', zones.length, 'ゾーン');
  }

  /**
   * SVGフロアプランを描画
   */
  _renderFloorPlan() {
    const svg = this.svgEl;
    svg.innerHTML = '';

    // 背景グリッド
    this._appendEl(svg, 'rect', {
      x: 0, y: 0, width: 1000, height: 600,
      fill: '#0f172a', rx: 8
    });

    // グリッドライン
    const gridG = this._appendEl(svg, 'g', { opacity: 0.15 });
    for (let x = 0; x <= 1000; x += 50) {
      this._appendEl(gridG, 'line', { x1: x, y1: 0, x2: x, y2: 600, stroke: '#334155', 'stroke-width': 0.5 });
    }
    for (let y = 0; y <= 600; y += 50) {
      this._appendEl(gridG, 'line', { x1: 0, y1: y, x2: 1000, y2: y, stroke: '#334155', 'stroke-width': 0.5 });
    }

    // 通路（中央縦・横）
    this._appendEl(svg, 'rect', { x: 325, y: 85, width: 350, height: 430, fill: '#1e293b', rx: 4, opacity: 0.6 });
    this._appendEl(svg, 'rect', { x: 0, y: 85, width: 1000, height: 430, fill: '#1e293b', rx: 4, opacity: 0.3 });

    // タイトルラベル
    const titleText = this._appendEl(svg, 'text', {
      x: 500, y: 310, 'text-anchor': 'middle', fill: '#334155',
      'font-size': '48', 'font-weight': '700', 'font-family': 'sans-serif',
      opacity: 0.3, 'pointer-events': 'none'
    });
    titleText.textContent = '通路';

    // 各ゾーンを描画
    for (const zone of this.zones) {
      this._renderZone(svg, zone);
    }

    // 凡例
    this._renderLegend(svg);
  }

  _renderZone(svg, zone) {
    const padding = 3;
    const g = this._appendEl(svg, 'g', {
      class: 'zone-group',
      'data-zone-id': zone.id,
      cursor: 'pointer'
    });

    // 影
    this._appendEl(g, 'rect', {
      x: zone.svgX + 3, y: zone.svgY + 3,
      width: zone.svgW, height: zone.svgH,
      rx: 8, fill: '#000', opacity: 0.3
    });

    // メイン矩形（クリック/ホバー対象）
    const rect = this._appendEl(g, 'rect', {
      id: `zone-rect-${zone.id}`,
      x: zone.svgX, y: zone.svgY,
      width: zone.svgW, height: zone.svgH,
      rx: 8,
      fill: '#1e293b',
      stroke: zone.color || '#475569',
      'stroke-width': 2,
      class: 'zone-rect'
    });

    // アイコン
    const iconText = this._appendEl(g, 'text', {
      id: `zone-icon-${zone.id}`,
      x: zone.svgX + zone.svgW / 2,
      y: zone.svgY + zone.svgH / 2 - 14,
      'text-anchor': 'middle',
      'font-size': Math.min(zone.svgH * 0.35, 28),
      'pointer-events': 'none'
    });
    iconText.textContent = this._getZoneIcon(zone.type);

    // ゾーン名
    const nameText = this._appendEl(g, 'text', {
      id: `zone-name-${zone.id}`,
      x: zone.svgX + zone.svgW / 2,
      y: zone.svgY + zone.svgH / 2 + 8,
      'text-anchor': 'middle',
      fill: '#e2e8f0',
      'font-size': Math.min(zone.svgH * 0.18, 13),
      'font-family': 'sans-serif',
      'font-weight': '600',
      'pointer-events': 'none'
    });
    nameText.textContent = zone.shortName || zone.name;

    // 混雑レベル表示
    const levelText = this._appendEl(g, 'text', {
      id: `zone-level-${zone.id}`,
      x: zone.svgX + zone.svgW / 2,
      y: zone.svgY + zone.svgH / 2 + 22,
      'text-anchor': 'middle',
      fill: '#94a3b8',
      'font-size': Math.min(zone.svgH * 0.15, 11),
      'font-family': 'monospace',
      'pointer-events': 'none'
    });
    levelText.textContent = '--';

    // トレンド矢印
    const trendText = this._appendEl(g, 'text', {
      id: `zone-trend-${zone.id}`,
      x: zone.svgX + zone.svgW - 10,
      y: zone.svgY + 16,
      'text-anchor': 'end',
      'font-size': 12,
      'pointer-events': 'none'
    });
    trendText.textContent = '';

    // イベント登録
    g.addEventListener('click', () => this._onZoneClick(zone.id));
    g.addEventListener('mouseenter', (e) => this._onZoneHover(e, zone.id, true));
    g.addEventListener('mouseleave', (e) => this._onZoneHover(e, zone.id, false));
    g.addEventListener('touchstart', () => this._onZoneClick(zone.id), { passive: true });
  }

  _renderLegend(svg) {
    const legendG = this._appendEl(svg, 'g', { transform: 'translate(10, 10)' });
    const colors = [
      { color: '#10b981', label: '空き' },
      { color: '#f59e0b', label: '普通' },
      { color: '#f97316', label: '混雑' },
      { color: '#ef4444', label: '大混雑' },
    ];
    colors.forEach((c, i) => {
      this._appendEl(legendG, 'rect', {
        x: i * 62, y: 0, width: 14, height: 14, rx: 3, fill: c.color
      });
      const t = this._appendEl(legendG, 'text', {
        x: i * 62 + 18, y: 11,
        fill: '#94a3b8', 'font-size': 10, 'font-family': 'sans-serif'
      });
      t.textContent = c.label;
    });
  }

  /**
   * 混雑データで各ゾーンの表示を更新
   * @param {Object} crowdingData - { zoneId: { level: 0-100, trend: 'up'|'down'|'stable' } }
   */
  update(crowdingData) {
    this.crowdingData = crowdingData || {};
    for (const zone of this.zones) {
      this._updateZoneDisplay(zone);
    }
  }

  _updateZoneDisplay(zone) {
    const data = this.crowdingData[zone.id];
    const level = data ? data.level : null;
    const trend = data ? data.trend : null;

    const rect = document.getElementById(`zone-rect-${zone.id}`);
    const levelEl = document.getElementById(`zone-level-${zone.id}`);
    const trendEl = document.getElementById(`zone-trend-${zone.id}`);
    const iconEl = document.getElementById(`zone-icon-${zone.id}`);

    if (!rect) return;

    if (level === null || level === undefined) {
      rect.setAttribute('fill', '#1e293b');
      rect.setAttribute('opacity', '0.7');
      if (levelEl) levelEl.textContent = 'No Data';
      if (trendEl) trendEl.textContent = '';
      return;
    }

    // 混雑レベルに応じた塗りつぶし色
    const fillColor = getCrowdingColor(level);
    const alpha = 0.15 + (level / 100) * 0.65;
    rect.setAttribute('fill', fillColor);
    rect.setAttribute('fill-opacity', alpha.toFixed(2));
    rect.setAttribute('opacity', '1');

    // 選択中ゾーンはボーダーを太く
    if (this.selectedZoneId === zone.id) {
      rect.setAttribute('stroke-width', '3');
      rect.setAttribute('stroke', '#ffffff');
    } else {
      rect.setAttribute('stroke-width', '2');
      rect.setAttribute('stroke', fillColor);
    }

    // レベルテキスト
    if (levelEl) {
      levelEl.textContent = `${level}%`;
      levelEl.setAttribute('fill', level > 60 ? '#fff' : '#94a3b8');
    }

    // トレンド矢印
    if (trendEl) {
      if (trend === 'up') {
        trendEl.textContent = '↑';
        trendEl.setAttribute('fill', '#ef4444');
      } else if (trend === 'down') {
        trendEl.textContent = '↓';
        trendEl.setAttribute('fill', '#10b981');
      } else {
        trendEl.textContent = '→';
        trendEl.setAttribute('fill', '#94a3b8');
      }
    }

    // パルスアニメーション（混雑時）
    if (iconEl) {
      iconEl.style.animation = level >= 80 ? 'pulse-icon 1.5s ease-in-out infinite' : '';
    }
  }

  /**
   * タイムライン予測モード：特定時刻の予測値を表示
   */
  showPrediction(predictions) {
    const predMap = {};
    for (const p of (predictions || [])) {
      predMap[p.zoneId] = { level: p.predictedLevel, trend: 'stable' };
    }
    this.update(predMap);
  }

  setSelectedZone(zoneId) {
    const prev = this.selectedZoneId;
    this.selectedZoneId = zoneId;
    if (prev) this._updateZoneDisplay(this.zones.find(z => z.id === prev) || {});
    if (zoneId) this._updateZoneDisplay(this.zones.find(z => z.id === zoneId) || {});
  }

  onZoneClick(callback) {
    this._onClickCallback = callback;
  }

  _onZoneClick(zoneId) {
    this.setSelectedZone(zoneId);
    if (this._onClickCallback) this._onClickCallback(zoneId);
  }

  _onZoneHover(event, zoneId, entering) {
    if (!this.tooltip) return;
    if (!entering) {
      this.tooltip.classList.add('hidden');
      return;
    }

    const zone = this.zones.find(z => z.id === zoneId);
    const data = this.crowdingData[zoneId];
    if (!zone) return;

    const level = data ? data.level : null;
    const count = data ? data.visitorCount : null;

    this.tooltip.querySelector('.tooltip-name').textContent = zone.name;
    this.tooltip.querySelector('.tooltip-level').textContent =
      level !== null ? `混雑度: ${level}% (${getCrowdingLabel(level)})` : '混雑度: データなし';
    this.tooltip.querySelector('.tooltip-count').textContent =
      count !== null ? `推定来客: ${count}人 / 定員${zone.capacity}人` : '';
    this.tooltip.querySelector('.tooltip-trend').textContent =
      data?.trend ? `トレンド: ${data.trend === 'up' ? '↑ 増加中' : data.trend === 'down' ? '↓ 減少中' : '→ 横ばい'}` : '';

    this.tooltip.classList.remove('hidden');
    // SVGコンテナ基準での位置調整
    const container = this.svgEl.parentElement;
    const rect = container.getBoundingClientRect();
    const x = event.clientX - rect.left + 12;
    const y = event.clientY - rect.top - 30;
    this.tooltip.style.left = `${Math.min(x, container.offsetWidth - 180)}px`;
    this.tooltip.style.top = `${Math.max(10, y)}px`;
  }

  _bindTooltip() {
    // touchendでツールチップを隠す
    document.addEventListener('touchend', () => {
      if (this.tooltip) this.tooltip.classList.add('hidden');
    });
  }

  _getZoneIcon(type) {
    const icons = {
      entrance: '🚪', food_court: '🍽️', checkout: '🛒', retail: '🛍️',
      service: '💁', rest: '🪑', parking: '🅿️'
    };
    return icons[type] || '📍';
  }

  _appendEl(parent, tag, attrs = {}) {
    const NS = 'http://www.w3.org/2000/svg';
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      el.setAttribute(k, v);
    }
    parent.appendChild(el);
    return el;
  }
}

window.floorPlan = new FloorPlan();
