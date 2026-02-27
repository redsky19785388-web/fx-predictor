/**
 * floor-plan.js - 上野公園 Leaflet.js マップヒートマップレンダラー v2.0
 *
 * 公開API（app.jsとの互換性を維持）:
 *   init(containerId, tooltipId, zones)
 *   update(crowdingData)
 *   showPrediction(predictions)
 *   setSelectedZone(zoneId)
 *   onZoneClick(callback)
 */

class FloorPlan {
  constructor() {
    this._map          = null;
    this.zones         = [];
    this.crowdingData  = {};
    this.selectedZoneId= null;
    this._onClickCb    = null;
    this._markers      = {}; // zoneId → { circle, labelMarker }
    this._heatLayer    = null;
    this._tooltipEl    = null;
    this._initialized  = false;
  }

  // ----------------------------------------------------------------
  // 初期化
  // ----------------------------------------------------------------
  init(containerId, tooltipId, zones) {
    this.zones      = zones || [];
    this._tooltipEl = document.getElementById(tooltipId);

    const container = document.getElementById(containerId);
    if (!container) {
      console.warn('[FloorPlan] コンテナが見つかりません:', containerId);
      return;
    }

    if (typeof L === 'undefined') {
      console.warn('[FloorPlan] Leaflet が読み込まれていません。フォールバック表示を使用します。');
      this._renderFallback(container);
      return;
    }

    // Leaflet マップ初期化
    const mapCfg = (CONFIG && CONFIG.map) || {};
    // center は配列 [lat,lng] またはオブジェクト { lat, lng } どちらでも対応
    const rawCenter = mapCfg.center || [35.7130, 139.7730];
    const centerArr = Array.isArray(rawCenter)
      ? rawCenter
      : [rawCenter.lat, rawCenter.lng];
    const zoom   = mapCfg.zoom   || 16;
    const tileUrl= mapCfg.tileUrl|| 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    this._map = L.map(containerId, {
      center: centerArr,
      zoom,
      zoomControl: true,
      attributionControl: false,
      scrollWheelZoom: true
    });

    // タイルレイヤー（CartoDB dark）
    L.tileLayer(tileUrl, {
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(this._map);

    // 簡易アトリビューション
    L.control.attribution({ prefix: false })
      .addAttribution('© <a href="https://carto.com/">CARTO</a>')
      .addTo(this._map);

    // ゾーンサークルと凡例を追加
    for (const zone of this.zones) {
      this._addZoneMarker(zone);
    }
    this._addMapLegend();

    this._initialized = true;
    console.log('[FloorPlan] Leaflet マップ初期化完了:', zones.length, 'ゾーン（上野公園）');
  }

  // ----------------------------------------------------------------
  // ゾーンマーカー追加
  // ----------------------------------------------------------------
  _addZoneMarker(zone) {
    const radius = zone.mapRadius || 40;

    // サークル（ヒートカラー円）
    const circle = L.circle([zone.lat, zone.lng], {
      radius,
      color:       zone.color,
      fillColor:   zone.color,
      fillOpacity: 0.18,
      weight:      2,
      className:   `zone-circle zone-circle-${zone.id}`
    }).addTo(this._map);

    // ラベルマーカー（divIcon）
    const labelHtml = `
      <div class="zone-map-label" id="zml-${zone.id}">
        <span class="zml-icon">${this._getZoneIcon(zone.type)}</span>
        <span class="zml-name">${this._shortName(zone.name)}</span>
        <span class="zml-level" id="zml-level-${zone.id}">--</span>
      </div>`;

    const icon = L.divIcon({
      className: '',
      html: labelHtml,
      iconAnchor: [0, 0]
    });
    const labelMarker = L.marker([zone.lat, zone.lng], { icon, interactive: true })
      .addTo(this._map);

    // クリックイベント
    circle.on('click',      () => this._onZoneClick(zone.id));
    labelMarker.on('click', () => this._onZoneClick(zone.id));

    // ホバーツールチップ（PCのみ）
    circle.on('mouseover',  (e) => this._showTooltip(e, zone));
    circle.on('mouseout',   ()  => this._hideTooltip());
    labelMarker.on('mouseover', (e) => this._showTooltip(e, zone));
    labelMarker.on('mouseout',  ()  => this._hideTooltip());

    this._markers[zone.id] = { circle, labelMarker };
  }

  // ----------------------------------------------------------------
  // データ更新
  // ----------------------------------------------------------------
  update(crowdingData) {
    this.crowdingData = crowdingData || {};
    for (const zone of this.zones) {
      this._updateZoneDisplay(zone);
    }
    this._updateHeatmap();
  }

  _updateZoneDisplay(zone) {
    const data  = this.crowdingData[zone.id];
    const level = data ? data.level : null;
    const m     = this._markers[zone.id];
    if (!m) return;

    const fillColor = (level !== null) ? getCrowdingColor(level) : zone.color;
    const alpha     = (level !== null) ? 0.12 + (level / 100) * 0.62 : 0.15;
    const isSelected= this.selectedZoneId === zone.id;

    m.circle.setStyle({
      color:       fillColor,
      fillColor,
      fillOpacity: alpha,
      weight:      isSelected ? 5 : 2,
      opacity:     isSelected ? 1.0 : 0.85
    });

    // ラベル更新
    const levelEl = document.getElementById(`zml-level-${zone.id}`);
    if (levelEl) {
      levelEl.textContent = level !== null ? `${level}%` : '--';
      levelEl.style.color = level !== null ? fillColor : '#94a3b8';
      levelEl.style.background = level !== null ? `${fillColor}25` : 'rgba(255,255,255,0.08)';
    }

    // ラベル全体のスタイル（選択中は枠線）
    const labelEl = document.getElementById(`zml-${zone.id}`);
    if (labelEl) {
      labelEl.style.borderColor = isSelected ? '#fff' : `${fillColor}80`;
      labelEl.style.boxShadow   = isSelected ? `0 0 12px ${fillColor}` : 'none';
    }

    // 高混雑時はパルス効果
    if (m.circle._path) {
      if (level >= 80) {
        m.circle._path.classList.add('zone-pulse');
      } else {
        m.circle._path.classList.remove('zone-pulse');
      }
    }
  }

  _updateHeatmap() {
    if (!this._map) return;
    if (typeof L.heatLayer === 'undefined') return;

    const points = [];
    for (const zone of this.zones) {
      const data = this.crowdingData[zone.id];
      if (data && data.level > 5) {
        points.push([zone.lat, zone.lng, data.level / 100]);
      }
    }

    if (this._heatLayer) {
      this._map.removeLayer(this._heatLayer);
      this._heatLayer = null;
    }
    if (points.length > 0) {
      this._heatLayer = L.heatLayer(points, {
        radius:  55,
        blur:    40,
        maxZoom: 17,
        gradient: { 0.25: '#10b981', 0.50: '#f59e0b', 0.75: '#f97316', 1.0: '#ef4444' }
      }).addTo(this._map);
    }
  }

  // ----------------------------------------------------------------
  // 予測表示
  // ----------------------------------------------------------------
  showPrediction(predictions) {
    const predMap = {};
    for (const p of (predictions || [])) {
      predMap[p.zoneId] = { level: p.predictedLevel, trend: 'stable' };
    }
    this.update(predMap);
  }

  // ----------------------------------------------------------------
  // ゾーン選択
  // ----------------------------------------------------------------
  setSelectedZone(zoneId) {
    const prev = this.selectedZoneId;
    this.selectedZoneId = zoneId;
    if (prev) this._updateZoneDisplay(this.zones.find(z => z.id === prev) || { id: prev });
    if (zoneId) {
      const zone = this.zones.find(z => z.id === zoneId);
      if (zone) {
        this._updateZoneDisplay(zone);
        if (this._map) {
          this._map.panTo([zone.lat, zone.lng], { animate: true, duration: 0.5 });
        }
      }
    }
  }

  onZoneClick(callback) {
    this._onClickCb = callback;
  }

  _onZoneClick(zoneId) {
    this.setSelectedZone(zoneId);
    if (this._onClickCb) this._onClickCb(zoneId);
  }

  // ----------------------------------------------------------------
  // ツールチップ
  // ----------------------------------------------------------------
  _showTooltip(e, zone) {
    if (!this._tooltipEl) return;
    const data  = this.crowdingData[zone.id];
    const level = data ? data.level : null;
    const count = data ? data.visitorCount : null;

    this._tooltipEl.querySelector('.tooltip-name').textContent  = zone.name;
    this._tooltipEl.querySelector('.tooltip-level').textContent =
      level !== null ? `混雑度: ${level}% （${getCrowdingLabel(level)}）` : '混雑度: データなし';
    this._tooltipEl.querySelector('.tooltip-count').textContent =
      count ? `推定来客: ${count}人 / 定員${zone.capacity}人` : '';
    this._tooltipEl.querySelector('.tooltip-trend').textContent =
      data?.trend ? `トレンド: ${data.trend==='up'?'↑ 増加中':data.trend==='down'?'↓ 減少中':'→ 横ばい'}` : '';

    this._tooltipEl.classList.remove('hidden');

    // マップコンテナ基準で位置決め
    const mapEl   = this._map?.getContainer();
    const rect    = mapEl ? mapEl.getBoundingClientRect() : { left: 0, top: 0 };
    const mx      = (e.originalEvent?.clientX || 0) - rect.left + 12;
    const my      = (e.originalEvent?.clientY || 0) - rect.top  - 30;
    const maxX    = mapEl ? mapEl.offsetWidth  - 180 : mx;
    const maxY    = mapEl ? mapEl.offsetHeight - 110 : my;
    this._tooltipEl.style.left = `${Math.min(mx, maxX)}px`;
    this._tooltipEl.style.top  = `${Math.max(10, Math.min(my, maxY))}px`;
  }

  _hideTooltip() {
    if (this._tooltipEl) this._tooltipEl.classList.add('hidden');
  }

  // ----------------------------------------------------------------
  // 凡例
  // ----------------------------------------------------------------
  _addMapLegend() {
    if (!this._map) return;
    const legend = L.control({ position: 'bottomright' });
    legend.onAdd = () => {
      const div = L.DomUtil.create('div', 'map-legend');
      div.innerHTML = `
        <div class="map-legend-title">混雑レベル</div>
        <div class="map-legend-item"><span style="background:#10b981"></span>空き（0-40%）</div>
        <div class="map-legend-item"><span style="background:#f59e0b"></span>普通（40-65%）</div>
        <div class="map-legend-item"><span style="background:#f97316"></span>混雑（65-80%）</div>
        <div class="map-legend-item"><span style="background:#ef4444"></span>大混雑（80%+）</div>`;
      return div;
    };
    legend.addTo(this._map);
  }

  // ----------------------------------------------------------------
  // フォールバック（Leaflet未読み込み時）
  // ----------------------------------------------------------------
  _renderFallback(container) {
    container.innerHTML = `
      <div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;
                  justify-content:center;background:#1e293b;border-radius:8px;gap:16px;">
        <div style="font-size:24px">🗺️</div>
        <div style="color:#64748b;font-size:13px;text-align:center">
          上野公園マップを読み込み中...<br>
          <small>地図はLeaflet.jsで表示されます</small>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;padding:0 16px">
          ${this.zones.map(z => `
            <div onclick="app.selectZone('${z.id}')"
                 style="display:flex;align-items:center;gap:6px;padding:6px 12px;
                        border-radius:8px;background:#0f172a;border:1px solid ${z.color};
                        cursor:pointer;font-size:12px">
              <span style="width:8px;height:8px;border-radius:50%;background:${z.color}"></span>
              <span style="color:#e2e8f0">${z.name}</span>
              <span id="fb-level-${z.id}" style="color:${z.color};font-weight:700">--</span>
            </div>`).join('')}
        </div>
      </div>`;
  }

  // ----------------------------------------------------------------
  // ヘルパー
  // ----------------------------------------------------------------
  _getZoneIcon(type) {
    const m = { cafe:'☕', museum:'🏛', park:'🌸', shrine:'⛩️', leisure:'🚣', market:'🏪' };
    return m[type] || '📍';
  }

  _shortName(name) {
    // 長いゾーン名を短縮
    return name.replace('付近のカフェ','カフェ')
               .replace('周辺','')
               .replace('乗り場付近','')
               .replace('・ぼたん苑','')
               .replace('商店街','')
               .trim()
               .split('・')[0]
               .substring(0, 10);
  }
}

window.floorPlan = new FloorPlan();
