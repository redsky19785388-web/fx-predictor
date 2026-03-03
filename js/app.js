/**
 * app.js - メインアプリケーションコントローラー
 * 全モジュールを初期化し、UIイベントと状態管理を担う
 */

const App = (function () {
  // -------- 状態 --------
  let _currentTab = 'dashboard';
  let _currentZoneId = null;
  let _currentFacility = CONFIG.defaultFacility;
  let _predictionResults = {}; // { zoneId: predictions[] }
  let _refreshInterval = null;
  let _currentPage = 1;
  const PAGE_SIZE = 20;

  // マネージャー補正状態
  let _overridePercent = 0;  // -50〜+50
  let _overrideReason  = '';

  // -------- 初期化 --------

  async function init() {
    console.log('[App] 初期化開始');

    // モジュール初期化
    dataManager.init();
    dummyGenerator; // グローバル登録済み
    weatherClient.init(_currentFacility.lat, _currentFacility.lng);
    eventManager.init();
    predictionEngine.init(dataManager, weatherClient, eventManager);
    floorPlan.init('map-container', 'zone-tooltip', _currentFacility.zones);
    alertManager.init(dataManager, predictionEngine);

    // 設定を反映
    const settings = dataManager.getSettings();
    if (settings.facilityName) {
      _currentFacility = { ..._currentFacility, name: settings.facilityName };
    }
    if (settings.lat && settings.lng) {
      weatherClient.init(settings.lat, settings.lng);
    }

    // UI初期構築
    _buildSidebar();
    _buildZoneSelects();
    _setupTabNavigation();
    _setupEventListeners();
    _setupDataForm();
    _setupDummyGenerator();
    _setupSettingsModal();
    _setupDataTable();

    // デフォルトゾーン選択
    _currentZoneId = _currentFacility.zones[0]?.id || null;

    // ヘッダー更新
    _updateHeader();
    document.getElementById('current-facility-name').textContent = _currentFacility.name;

    // フロアプランのゾーンクリックハンドラ
    floorPlan.onZoneClick(zoneId => {
      _currentZoneId = zoneId;
      _updateSidebarSelection(zoneId);
      _refreshDashboard();
    });

    // アラートコールバック
    alertManager.onNewAlert(alerts => {
      if (alerts.length > 0) alertManager.showBanner(alerts[0]);
    });

    // 天気取得
    _fetchWeather();

    // 祝日データ取得
    holidayClient.fetchHolidays().then(() => {
      _updateDataSourceStatus();
    });

    // 自動収集UI初期化
    _setupAutoCollector();

    // マネージャー補正UI初期化
    _setupOverrideUI();

    // Ground Truth入力フォーム初期化
    _setupGroundTruthForm();

    // リアルタイム・コンテキスト初期化（3分ごと自動更新）
    realtimeContext.init(3 * 60 * 1000);
    realtimeContext.onChange(() => _renderRealtimePanels());

    // ダッシュボード初期表示
    await _refreshDashboard();

    // 自動更新（5分ごと）
    _refreshInterval = setInterval(() => _autoRefresh(), 5 * 60 * 1000);

    // 日時表示（1分ごと）
    setInterval(_updateHeader, 60000);

    console.log('[App] 初期化完了');
  }

  // -------- サイドバー --------

  function _buildSidebar() {
    const facilityList = document.getElementById('facility-list');
    if (facilityList) {
      facilityList.innerHTML = `
        <div class="facility-item active">
          <span class="facility-icon">🌳</span>
          <span class="facility-name">${_currentFacility.name}</span>
        </div>`;
    }

    const zoneList = document.getElementById('zone-list');
    if (!zoneList) return;
    zoneList.innerHTML = _currentFacility.zones.map(zone => `
      <div class="zone-item" data-zone-id="${zone.id}" onclick="app.selectZone('${zone.id}')">
        <span class="zone-dot" style="background:${zone.color}"></span>
        <span class="zone-name">${zone.shortName || zone.name}</span>
        <span class="zone-level-badge" id="sidebar-level-${zone.id}">--</span>
      </div>
    `).join('');
  }

  function _updateSidebarSelection(zoneId) {
    document.querySelectorAll('.zone-item').forEach(el => {
      el.classList.toggle('active', el.dataset.zoneId === zoneId);
    });
  }

  // -------- ゾーン選択肢 --------

  function _buildZoneSelects() {
    const optionsHTML = _currentFacility.zones.map(z =>
      `<option value="${z.id}">${z.name}</option>`
    ).join('');

    ['trend-zone-select', 'pred-zone-select', 'entry-zone', 'table-zone-filter'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        const hasAll = id === 'table-zone-filter';
        el.innerHTML = (hasAll ? '<option value="">全ゾーン</option>' : '') + optionsHTML;
      }
    });
  }

  // -------- タブナビゲーション --------

  function _setupTabNavigation() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // 予測タブの日付初期値（今日）
    const predDate = document.getElementById('pred-date');
    if (predDate) {
      const today = new Date().toISOString().split('T')[0];
      predDate.value = today;
      predDate.min = today;
    }
  }

  function switchTab(tabId) {
    _currentTab = tabId;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${tabId}`));

    if (tabId === 'alerts') {
      alertManager.renderAlertList();
      alertManager.markAllRead();
      alertManager.refreshBadge();
    } else if (tabId === 'data') {
      _renderDataTable();
      _setupEventManagement();
      _renderGroundTruthHistory();
    }
  }

  // -------- イベントリスナー --------

  function _setupEventListeners() {
    // サイドバートグル
    document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
      document.getElementById('sidebar')?.classList.toggle('open');
    });

    // クイックアクション
    document.getElementById('btn-generate-dummy')?.addEventListener('click', () => switchTab('data'));
    document.getElementById('btn-run-prediction')?.addEventListener('click', () => {
      switchTab('prediction');
      _runPrediction();
    });
    document.getElementById('btn-export-data')?.addEventListener('click', _exportData);
    document.getElementById('btn-toggle-autocollect')?.addEventListener('click', () => {
      switchTab('data');
      document.getElementById('auto-collect-panel')?.scrollIntoView({ behavior: 'smooth' });
    });

    // 予測実行ボタン
    document.getElementById('btn-run-pred')?.addEventListener('click', _runPrediction);

    // ゾーン変更時にグラフ更新
    document.getElementById('trend-zone-select')?.addEventListener('change', e => {
      _currentZoneId = e.target.value;
      _refreshDashboard();
    });

    // 設定ボタン
    document.getElementById('btn-settings')?.addEventListener('click', openSettings);

    // 全既読ボタン
    document.getElementById('btn-mark-all-read')?.addEventListener('click', () => {
      alertManager.markAllRead();
      alertManager.renderAlertList();
    });
  }

  // -------- ダッシュボード更新 --------

  async function _refreshDashboard() {
    const latest = dataManager.getLatestCrowdingByZone();

    // フロアプランヒートマップ更新
    const crowdingData = {};
    for (const zone of _currentFacility.zones) {
      const rec = latest[zone.id];
      if (rec) {
        // 直近1時間以内のデータがあればトレンド計算
        const recent = dataManager.getRecords({ zoneId: zone.id, limit: 3 });
        let trend = 'stable';
        if (recent.length >= 2) {
          const diff = recent[0].crowdingLevel - recent[1].crowdingLevel;
          if (diff > 5) trend = 'up';
          else if (diff < -5) trend = 'down';
        }
        crowdingData[zone.id] = {
          level: rec.crowdingLevel,
          trend,
          visitorCount: rec.visitorCount
        };
        // サイドバーバッジ更新
        const badge = document.getElementById(`sidebar-level-${zone.id}`);
        if (badge) {
          badge.textContent = `${rec.crowdingLevel}%`;
          badge.style.background = `${getCrowdingColor(rec.crowdingLevel)}33`;
          badge.style.color = getCrowdingColor(rec.crowdingLevel);
        }
      }
    }
    floorPlan.update(crowdingData);

    // サマリーカード更新
    const currentZone = _currentFacility.zones.find(z => z.id === _currentZoneId);
    const currentData = _currentZoneId ? crowdingData[_currentZoneId] : null;

    _updateSummaryCards(currentData, currentZone);

    // 当日グラフ
    const records = _currentZoneId
      ? dataManager.getTodayData(_currentZoneId)
      : [];
    const zoneForChart = currentZone || _currentFacility.zones[0];
    if (zoneForChart) {
      chartManager.renderTodayTrend('today-trend-chart', records, zoneForChart.name);
    }

    // レコメンデーション（キャッシュ済みなら即表示）
    if (_currentZoneId && _predictionResults[_currentZoneId]) {
      const recommendations = predictionEngine.generateRecommendations(
        _predictionResults[_currentZoneId],
        currentZone || _currentFacility.zones[0]
      );
      alertManager.renderRecommendations(recommendations);
    } else {
      alertManager.renderRecommendations([]);
    }

    alertManager.refreshBadge();
    document.getElementById('active-alerts').textContent = dataManager.getUnreadAlertCount();

    // 精度パネル更新
    _renderAccuracyPanel(_currentZoneId);

    // リアルタイム・コンテキスト・ペルソナ・アクション提案パネルを更新
    _renderRealtimePanels();
  }

  function _updateSummaryCards(currentData, zone) {
    // 現在の混雑度
    const crowdingEl = document.getElementById('current-crowding');
    if (crowdingEl) {
      if (currentData) {
        crowdingEl.textContent = `${currentData.level}%`;
        crowdingEl.style.color = getCrowdingColor(currentData.level);
      } else {
        crowdingEl.textContent = '--';
        crowdingEl.style.color = '';
      }
    }

    // トレンド
    const trendEl = document.getElementById('crowding-trend');
    if (trendEl && currentData) {
      trendEl.textContent = currentData.trend === 'up' ? '↑ 増加中' : currentData.trend === 'down' ? '↓ 減少中' : '→ 横ばい';
      trendEl.style.color = currentData.trend === 'up' ? '#ef4444' : currentData.trend === 'down' ? '#10b981' : '#94a3b8';
    }

    // 次のピーク（キャッシュから）
    if (_currentZoneId && _predictionResults[_currentZoneId]) {
      const peak = predictionEngine.getPeakTime(_predictionResults[_currentZoneId]);
      if (peak) {
        const peakTimeEl = document.getElementById('next-peak-time');
        const peakLevelEl = document.getElementById('next-peak-level');
        if (peakTimeEl) peakTimeEl.textContent = formatTime(peak.targetTs);
        if (peakLevelEl) peakLevelEl.textContent = `予測: ${peak.predictedLevel}%`;
      }
    }
  }

  // -------- 予測実行 --------

  async function _runPrediction() {
    const zoneId = document.getElementById('pred-zone-select')?.value || _currentZoneId;
    const dateInput = document.getElementById('pred-date')?.value;
    const targetDate = dateInput ? new Date(dateInput) : new Date();
    const zone = _currentFacility.zones.find(z => z.id === zoneId);
    if (!zone) { showToast('ゾーンを選択してください', 'warning'); return; }

    showToast('予測計算中...', 'info', 5000);
    document.getElementById('btn-run-pred').disabled = true;
    document.getElementById('btn-run-pred').textContent = '⏳ 計算中...';

    try {
      const predictions = await predictionEngine.predictDay(zoneId, targetDate);
      _predictionResults[zoneId] = predictions;

      // 予測グラフ（マネージャー補正を反映）
      const todayRecords = dataManager.getTodayData(zoneId);
      const overrideMult = 1 + _overridePercent / 100;
      chartManager.renderPredictionChart('prediction-chart', predictions, todayRecords, overrideMult);

      // 信頼度
      const avgConf = predictions.reduce((s, p) => s + (p?.confidence || 0), 0) / predictions.length;
      const confEl = document.getElementById('pred-confidence');
      if (confEl) confEl.textContent = Math.round(avgConf * 100);

      // 因子チャート（ピーク時の値を使用）
      const peak = predictionEngine.getPeakTime(predictions);
      if (peak?.factors) {
        chartManager.renderFactorChart('factor-chart', peak.factors);
      }

      // 天気予報表示
      _renderWeatherForecast();

      // イベント表示
      _renderEventList(targetDate);

      // AIレコメンデーション
      const recommendations = predictionEngine.generateRecommendations(predictions, zone);
      _renderAiRecommendations(recommendations);

      // アラート生成
      await alertManager.generateFromPredictions([{ zoneId, predictions }]);

      // ダッシュボードのサマリーカードも更新
      const nextPeakEl = document.getElementById('next-peak-time');
      const nextPeakLvEl = document.getElementById('next-peak-level');
      if (peak && nextPeakEl) {
        nextPeakEl.textContent = formatTime(peak.targetTs);
        if (nextPeakLvEl) nextPeakLvEl.textContent = `予測: ${peak.predictedLevel}%`;
      }

      showToast(`予測完了: ${zone.name}（信頼度 ${Math.round(avgConf * 100)}%）`, 'success');

    } catch (e) {
      console.error('[App] 予測エラー:', e);
      showToast('予測の実行に失敗しました', 'error');
    } finally {
      document.getElementById('btn-run-pred').disabled = false;
      document.getElementById('btn-run-pred').textContent = '🔮 予測実行';
    }
  }

  function _renderWeatherForecast() {
    const container = document.getElementById('weather-forecast-list');
    if (!container) return;

    const summary = weatherClient.getDailyForecastSummary();
    if (!summary || summary.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>天気データを取得中...</p></div>';
      return;
    }

    container.innerHTML = summary.map(day => {
      const date = new Date(day.date);
      const dayName = `${DAY_NAMES_JA[date.getDay()]}曜`;
      const mod = weatherClient.getWeatherModifier({ category: day.category, temperature: day.maxTemp }, true);
      const modPct = Math.round((mod - 1) * 100);
      const modStr = modPct > 0 ? `+${modPct}%` : `${modPct}%`;
      const modColor = modPct > 5 ? '#10b981' : modPct < -5 ? '#ef4444' : '#94a3b8';
      return `
        <div class="weather-day-item">
          <span class="weather-day">${dayName}</span>
          <span class="weather-icon-lg">${day.icon}</span>
          <div class="weather-temps">
            <span class="temp-max">${day.maxTemp}°</span>
            <span class="temp-min">${day.minTemp}°</span>
          </div>
          <span class="weather-impact" style="color:${modColor}">${modStr}</span>
          ${day.precipitation > 0 ? `<span class="weather-rain">💧${day.precipitation}mm</span>` : ''}
        </div>`;
    }).join('');
  }

  function _renderEventList(targetDate) {
    const container = document.getElementById('event-list');
    if (!container) return;

    const events = eventManager.getUpcomingEvents(14);
    if (events.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>登録されたイベントはありません</p><small>データ管理タブから追加できます</small></div>';
      return;
    }

    container.innerHTML = events.map(evt => {
      const pct = Math.round((evt.impact - 1) * 100);
      const now = Date.now();
      const isActive = now >= evt.startTs && now <= evt.endTs;
      const fmtTs = ts => new Date(ts).toLocaleString('ja-JP',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
      return `
        <div class="event-item${isActive ? ' event-active' : ''}">
          <div class="event-icon">${eventManager.getEventTypeIcon(evt.type)}</div>
          <div class="event-body">
            <div class="event-name">${evt.name}${isActive ? ' <span class="event-live-badge">開催中</span>' : ''}</div>
            <div class="event-meta">${fmtTs(evt.startTs)} 〜 ${fmtTs(evt.endTs)}</div>
          </div>
          <div class="event-impact">+${pct}%</div>
        </div>`;
    }).join('');
  }

  let _eventManagementReady = false;
  function _setupEventManagement() {
    if (_eventManagementReady) {
      eventManager.renderEventList('event-manage-list');
      return;
    }
    eventManager.renderEventRegistrationForm('event-registration-container');
    eventManager.renderEventList('event-manage-list');
    _eventManagementReady = true;
  }

  function _renderAiRecommendations(recommendations) {
    const container = document.getElementById('ai-recommendations');
    if (!container) return;

    if (!recommendations || recommendations.length === 0) {
      container.innerHTML = `<div class="empty-state"><p>予測データからレコメンデーションが生成されます</p></div>`;
      return;
    }

    container.innerHTML = recommendations.map(rec => `
      <div class="ai-rec-card ${rec.severity}">
        <div class="ai-rec-header">
          <span class="ai-rec-icon">${alertManager._getTypeIcon(rec.type)}</span>
          <span class="ai-rec-time">${alertManager._formatAlertTime(rec.time)}</span>
          <span class="ai-rec-badge ${rec.severity}">${alertManager._getSeverityLabel(rec.severity)}</span>
        </div>
        <p class="ai-rec-message">${rec.message}</p>
        <div class="ai-rec-action">
          <span class="action-label">推奨アクション</span>
          <p>${rec.action}</p>
        </div>
      </div>
    `).join('');
  }

  // -------- データ入力フォーム --------

  function _setupDataForm() {
    const form = document.getElementById('data-entry-form');
    if (!form) return;

    // 日時のデフォルト値
    const dtInput = document.getElementById('entry-datetime');
    if (dtInput) {
      const now = new Date();
      now.setMinutes(0, 0, 0);
      dtInput.value = now.toISOString().slice(0, 16);
    }

    form.addEventListener('submit', e => {
      e.preventDefault();
      const zoneId = document.getElementById('entry-zone').value;
      const datetime = new Date(document.getElementById('entry-datetime').value).getTime();
      const level = parseInt(document.getElementById('entry-level').value);
      const count = parseInt(document.getElementById('entry-count').value) || null;
      const notes = document.getElementById('entry-notes').value;

      dataManager.saveRecord({ zoneId, timestamp: datetime, crowdingLevel: level, visitorCount: count, notes });
      showToast('データを保存しました', 'success');
      _renderDataTable();
      form.reset();
    });
  }

  // -------- ダミーデータ生成 --------

  function _setupDummyGenerator() {
    document.getElementById('btn-generate')?.addEventListener('click', () => {
      const period = parseInt(document.getElementById('dummy-period').value) || 30;
      const facilityType = document.getElementById('dummy-facility-type').value || 'mall';
      const options = {
        includeEvents: document.getElementById('dummy-include-events').checked,
        includeWeather: document.getElementById('dummy-include-weather').checked,
        includeHolidays: document.getElementById('dummy-include-holidays').checked
      };

      const resultEl = document.getElementById('generation-result');
      if (resultEl) {
        resultEl.innerHTML = '<div class="loading-spinner">⏳ 生成中...</div>';
        resultEl.classList.remove('hidden');
      }

      setTimeout(() => {
        try {
          const count = dummyGenerator.generate(facilityType, period, options, _currentFacility.zones);
          predictionEngine.clearCache();
          if (resultEl) {
            resultEl.innerHTML = `<div class="success-msg">✅ ${count.toLocaleString()}件のデータを生成しました</div>`;
          }
          showToast(`${count.toLocaleString()}件のテストデータを生成しました`, 'success');
          _renderDataTable();
          _refreshDashboard();
        } catch (e) {
          console.error(e);
          showToast('データ生成に失敗しました', 'error');
        }
      }, 50);
    });

    document.getElementById('btn-clear-data')?.addEventListener('click', () => {
      if (!confirm('全データを削除しますか？この操作は元に戻せません。')) return;
      dataManager.deleteAllRecords();
      predictionEngine.clearCache();
      showToast('全データを削除しました', 'info');
      _renderDataTable();
      _refreshDashboard();
    });
  }

  // -------- データテーブル --------

  function _setupDataTable() {
    document.getElementById('table-zone-filter')?.addEventListener('change', () => {
      _currentPage = 1;
      _renderDataTable();
    });
    document.getElementById('table-date-filter')?.addEventListener('change', () => {
      _currentPage = 1;
      _renderDataTable();
    });
    document.getElementById('btn-prev-page')?.addEventListener('click', () => {
      if (_currentPage > 1) { _currentPage--; _renderDataTable(); }
    });
    document.getElementById('btn-next-page')?.addEventListener('click', () => {
      _currentPage++;
      _renderDataTable();
    });
  }

  function _renderDataTable() {
    const tbody = document.getElementById('data-table-body');
    if (!tbody) return;

    const zoneFilter = document.getElementById('table-zone-filter')?.value || '';
    const dateFilter = document.getElementById('table-date-filter')?.value || '';

    let startTime = null;
    let endTime = null;
    if (dateFilter) {
      startTime = new Date(dateFilter).getTime();
      endTime = startTime + 24 * 60 * 60 * 1000;
    }

    const records = dataManager.getRecords({
      zoneId: zoneFilter || null,
      startTime, endTime,
      limit: 10000
    });

    const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
    if (_currentPage > totalPages) _currentPage = totalPages;

    const pageRecords = records.slice((_currentPage - 1) * PAGE_SIZE, _currentPage * PAGE_SIZE);

    document.getElementById('page-info').textContent = `${_currentPage} / ${totalPages}`;
    document.getElementById('btn-prev-page').disabled = _currentPage <= 1;
    document.getElementById('btn-next-page').disabled = _currentPage >= totalPages;

    if (pageRecords.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-cell">データがありません</td></tr>`;
      return;
    }

    const zoneMap = {};
    _currentFacility.zones.forEach(z => { zoneMap[z.id] = z.name; });

    tbody.innerHTML = pageRecords.map(r => {
      const color = getCrowdingColor(r.crowdingLevel);
      return `<tr>
        <td>${formatDateTime(r.timestamp)}</td>
        <td>${zoneMap[r.zoneId] || r.zoneId}</td>
        <td>
          <div class="level-cell">
            <span class="level-bar" style="width:${r.crowdingLevel}%;background:${color}30;border-color:${color}"></span>
            <span style="color:${color};font-weight:600">${r.crowdingLevel}%</span>
          </div>
        </td>
        <td>${r.visitorCount !== null ? r.visitorCount.toLocaleString() + '人' : '--'}</td>
        <td class="notes-cell">${r.notes || '--'}</td>
      </tr>`;
    }).join('');
  }

  // -------- 天気ウィジェット --------

  async function _fetchWeather() {
    try {
      await weatherClient.fetchForecast();
      const now = new Date();
      now.setMinutes(0, 0, 0);
      const current = weatherClient.getForecastForDateTime(now);
      document.getElementById('weather-icon').textContent = current.icon || '☁';
      document.getElementById('weather-temp').textContent = `${Math.round(current.temperature)}°C`;
      document.getElementById('weather-desc').textContent = current.description || '取得済み';

      // 天気影響カード
      const mod = weatherClient.getWeatherModifier(current, true);
      const pct = Math.round((mod - 1) * 100);
      document.getElementById('weather-impact').textContent = `${pct > 0 ? '+' : ''}${pct}%`;
      document.getElementById('weather-impact').style.color = pct > 5 ? '#10b981' : pct < -5 ? '#ef4444' : '#94a3b8';
      document.getElementById('weather-impact-detail').textContent = current.description || '--';
      document.getElementById('weather-api-status').innerHTML = `<span class="status-dot active"></span> 接続済み`;
    } catch (e) {
      console.warn('[App] 天気取得失敗:', e);
    }
  }

  // -------- 設定モーダル --------

  function _setupSettingsModal() {
    const settings = dataManager.getSettings();
    const nameInput = document.getElementById('setting-facility-name');
    const latInput = document.getElementById('setting-lat');
    const lngInput = document.getElementById('setting-lng');

    if (nameInput) nameInput.value = settings.facilityName || _currentFacility.name;
    if (latInput) latInput.value = settings.lat || _currentFacility.lat;
    if (lngInput) lngInput.value = settings.lng || _currentFacility.lng;

    document.getElementById('btn-save-settings')?.addEventListener('click', () => {
      const newSettings = {
        facilityName: nameInput?.value || _currentFacility.name,
        lat: parseFloat(latInput?.value) || _currentFacility.lat,
        lng: parseFloat(lngInput?.value) || _currentFacility.lng,
      };
      dataManager.saveSettings(newSettings);
      _currentFacility = { ..._currentFacility, name: newSettings.facilityName };
      weatherClient.init(newSettings.lat, newSettings.lng);
      document.getElementById('current-facility-name').textContent = newSettings.facilityName;
      document.querySelector('.facility-name').textContent = newSettings.facilityName;
      closeSettings();
      _fetchWeather();
      showToast('設定を保存しました', 'success');
    });
  }

  function openSettings() {
    document.getElementById('settings-modal')?.classList.remove('hidden');
  }

  function closeSettings() {
    document.getElementById('settings-modal')?.classList.add('hidden');
  }

  // -------- データエクスポート --------

  function _exportData() {
    const json = dataManager.exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crowdsense-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('データをエクスポートしました', 'success');
  }

  // -------- ヘッダー更新 --------

  function _updateHeader() {
    const el = document.getElementById('current-datetime');
    if (el) {
      const now = new Date();
      el.textContent = now.toLocaleString('ja-JP', {
        year: 'numeric', month: 'long', day: 'numeric',
        weekday: 'short', hour: '2-digit', minute: '2-digit'
      });
    }
    const lastUpdate = document.getElementById('last-update-time');
    if (lastUpdate) {
      lastUpdate.textContent = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    }
  }

  async function _autoRefresh() {
    await _fetchWeather();
    await _refreshDashboard();
    document.getElementById('last-update-time').textContent =
      new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  }

  // -------- v3.0: リアルタイム・コンテキスト / ペルソナ / アクション提案 --------

  /** 3つの新パネルをまとめて再描画する */
  function _renderRealtimePanels() {
    const ctx = realtimeContext.getData();
    _renderTransitPanel(ctx.transit, ctx.lastUpdated);
    _renderNearbyPanel(ctx.nearbyCrowding);
    _renderSnsPanel(ctx.snsTrends);
    _renderPersonaPanel(ctx);
    _renderActionPanel(ctx);
  }

  /** 交通機関リストを描画 */
  function _renderTransitPanel(transit, lastUpdated) {
    const el = document.getElementById('rt-transit-list');
    if (!el) return;

    if (!transit || !transit.length) {
      el.innerHTML = '<div class="empty-state"><p>データ取得中...</p></div>';
      return;
    }

    el.innerHTML = transit.map(line => `
      <div class="rt-transit-item">
        <span class="rt-transit-icon">${line.icon}</span>
        <span class="rt-transit-name">${line.name}</span>
        <span class="rt-transit-status ${line.status}">${line.message}</span>
      </div>
    `).join('');

    const updEl = document.getElementById('rt-transit-updated');
    if (updEl && lastUpdated) {
      updEl.textContent = `更新: ${new Date(lastUpdated).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`;
    }
  }

  /** 近隣施設混雑を描画 */
  function _renderNearbyPanel(nearby) {
    const el = document.getElementById('rt-nearby-list');
    if (!el) return;

    if (!nearby || !nearby.length) {
      el.innerHTML = '<div class="empty-state"><p>データ取得中...</p></div>';
      return;
    }

    el.innerHTML = nearby.map(f => {
      const color = getCrowdingColor(f.level);
      return `
        <div class="rt-nearby-item">
          <span class="rt-nearby-icon">${f.icon}</span>
          <div class="rt-nearby-info">
            <div class="rt-nearby-name">${f.name}</div>
            <div class="rt-nearby-bar-wrap">
              <div class="rt-nearby-bar" style="width:${f.level}%;background:${color}"></div>
            </div>
          </div>
          <span class="rt-nearby-pct" style="color:${color}">${f.level}%</span>
        </div>
      `;
    }).join('');
  }

  /** SNSトレンドを描画 */
  function _renderSnsPanel(trends) {
    const el = document.getElementById('rt-sns-list');
    if (!el) return;

    if (!trends || !trends.length) {
      el.innerHTML = '<div class="empty-state"><p>データ取得中...</p></div>';
      return;
    }

    el.innerHTML = trends.map(t => {
      const arrowClass = t.delta >= 0 ? 'up' : 'down';
      const arrowChar  = t.delta >= 0 ? '▲' : '▼';
      return `
        <span class="rt-sns-chip ${t.trending ? 'trending' : ''}">
          ${t.keyword}
          <span class="rt-sns-arrow ${arrowClass}">${arrowChar}${Math.abs(t.delta)}</span>
        </span>
      `;
    }).join('');
  }

  /** ペルソナ推計パネルを描画 */
  function _renderPersonaPanel(ctx) {
    const barsEl  = document.getElementById('persona-bars');
    const cardsEl = document.getElementById('persona-top-cards');
    if (!barsEl || !cardsEl) return;

    const now = new Date();
    const hour = now.getHours();
    const dow  = now.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const isHoliday = holidayClient.isLoaded() && holidayClient.isHoliday(
      now.toISOString().split('T')[0]
    );
    const month = now.getMonth() + 1;

    const worstDelay = realtimeContext.getWorstTransitDelay();
    const weather = weatherClient.getForecastForDateTime ? weatherClient.getForecastForDateTime(now) : null;

    const estimates = personaEngine.estimate({
      zoneId: _currentZoneId,
      hour,
      isWeekend,
      isHoliday,
      weather,
      transitDelayMin: worstDelay.delayMin,
      month
    });

    // バー表示
    barsEl.innerHTML = estimates.map(p => `
      <div class="persona-bar-item">
        <span class="persona-bar-icon">${p.icon}</span>
        <span class="persona-bar-label" title="${p.label}">${p.short}</span>
        <div class="persona-bar-track">
          <div class="persona-bar-fill" style="width:${p.percentage}%;background:${p.color}"></div>
        </div>
        <span class="persona-bar-pct" style="color:${p.color}">${p.percentage}%</span>
      </div>
    `).join('');

    // 上位3件カード
    const top3 = personaEngine.getTop(estimates, 3);
    cardsEl.innerHTML = top3.map((p, i) => `
      <div class="persona-card rank-${i + 1}" style="border-left-color:${p.color}">
        <div class="persona-card-header">
          <span class="persona-card-icon">${p.icon}</span>
          <span class="persona-card-label">${p.label}</span>
          <span class="persona-card-pct" style="color:${p.color}">${p.percentage}%</span>
        </div>
        <div class="persona-card-desc">${p.desc}</div>
      </div>
    `).join('');

    // アクション提案パネルも同時に更新（estimatesを共有）
    _renderActionSuggestions(estimates, ctx, { hour, isWeekend, isHoliday, month });
  }

  /** アクション提案パネルを描画（personaパネルから呼ばれる） */
  function _renderActionSuggestions(estimates, ctx, { hour, isWeekend, isHoliday, month }) {
    const el = document.getElementById('action-suggestions');
    if (!el) return;

    const now = new Date();
    const weather = weatherClient.getForecastForDateTime ? weatherClient.getForecastForDateTime(now) : null;

    const suggestions = actionSuggester.generate({
      personas:  estimates,
      weather,
      transit:   ctx.transit || [],
      zoneId:    _currentZoneId,
      hour,
      isWeekend,
      isHoliday,
      month
    });

    el.innerHTML = suggestions.map(s => `
      <div class="action-card priority-${s.priority}">
        <div class="action-card-top">
          <span class="action-card-icon">${s.icon}</span>
          <div class="action-card-meta">
            <span class="action-card-tag">${s.tag}</span>
            <div class="action-card-title">${s.title}</div>
          </div>
        </div>
        <div class="action-card-message">${s.message}</div>
      </div>
    `).join('');

    const updEl = document.getElementById('action-last-updated');
    if (updEl) {
      updEl.textContent = `最終更新: ${now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`;
    }
  }

  /** アクション提案パネルのみを外部から呼ぶラッパー（realtimeContext変化時） */
  function _renderActionPanel(ctx) {
    // ペルソナ推計を取得してからアクション提案を更新
    const now = new Date();
    const hour = now.getHours();
    const dow  = now.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const isHoliday = holidayClient.isLoaded() && holidayClient.isHoliday(
      now.toISOString().split('T')[0]
    );
    const month = now.getMonth() + 1;
    const worstDelay = realtimeContext.getWorstTransitDelay();
    const weather = weatherClient.getForecastForDateTime ? weatherClient.getForecastForDateTime(now) : null;

    const estimates = personaEngine.estimate({
      zoneId: _currentZoneId,
      hour, isWeekend, isHoliday, weather,
      transitDelayMin: worstDelay.delayMin,
      month
    });

    _renderActionSuggestions(estimates, ctx, { hour, isWeekend, isHoliday, month });
  }

  // -------- 1. AI予測精度パネル --------

  function _renderAccuracyPanel(zoneId) {
    const stats = predictionEngine.getAccuracyStats(zoneId || null, 7);
    const ringEl   = document.getElementById('accuracy-ring');
    const scoreEl  = document.getElementById('accuracy-score');
    const maeEl    = document.getElementById('accuracy-mae');
    const biasEl   = document.getElementById('accuracy-bias');
    const factorEl = document.getElementById('accuracy-bias-factor');
    const samplesEl= document.getElementById('accuracy-samples');

    if (!stats || stats.sampleCount === 0) {
      // データなし
      if (ringEl) ringEl.style.background = `conic-gradient(#334155 100%, #334155 100%)`;
      if (scoreEl) scoreEl.textContent = '--';
      if (maeEl)    maeEl.textContent    = '-- pt';
      if (biasEl)   biasEl.textContent   = '--';
      if (factorEl) factorEl.textContent = '1.00 ×';
      if (samplesEl) samplesEl.textContent = '0 件';
      return;
    }

    const pct = stats.accuracy;
    const color = pct >= 90 ? '#10b981' : pct >= 75 ? '#6366f1' : pct >= 60 ? '#f59e0b' : '#ef4444';
    if (ringEl) {
      ringEl.style.background = `conic-gradient(${color} ${pct}%, #2d3f55 ${pct}%)`;
    }
    if (scoreEl)  scoreEl.textContent  = pct;
    if (maeEl)    maeEl.textContent     = `${stats.mae} pt`;
    if (biasEl) {
      const biasSign = stats.bias > 0 ? '+' : '';
      biasEl.textContent  = `${biasSign}${stats.bias} pt`;
      biasEl.style.color  = Math.abs(stats.bias) > 5 ? '#f59e0b' : '#94a3b8';
    }
    if (factorEl) {
      factorEl.textContent = `${stats.biasFactor.toFixed(2)} ×`;
      factorEl.style.color = stats.biasFactor !== 1.0 ? '#6366f1' : '#94a3b8';
    }
    if (samplesEl) samplesEl.textContent = `${stats.sampleCount} 件`;
  }

  // -------- 2. マネージャー補正UI --------

  function _setupOverrideUI() {
    const slider     = document.getElementById('override-slider');
    const badge      = document.getElementById('override-badge');
    const reasonInput= document.getElementById('override-reason');
    const reasonDisp = document.getElementById('override-reason-display');

    if (!slider) return;

    function _updateOverrideBadge(val) {
      const pct = parseInt(val);
      _overridePercent = pct;
      const sign = pct > 0 ? '+' : '';
      if (badge) {
        badge.textContent  = `${sign}${pct}%`;
        badge.className    = `override-badge ${pct > 0 ? 'positive' : pct < 0 ? 'negative' : 'neutral'}`;
      }
    }

    slider.addEventListener('input', () => {
      _updateOverrideBadge(slider.value);
      // キャッシュ済みの予測があれば即座にグラフ更新
      const zoneId = document.getElementById('pred-zone-select')?.value || _currentZoneId;
      if (zoneId && _predictionResults[zoneId]) {
        const todayRec = dataManager.getTodayData(zoneId);
        chartManager.renderPredictionChart('prediction-chart', _predictionResults[zoneId], todayRec, 1 + _overridePercent / 100);
      }
    });

    reasonInput?.addEventListener('input', () => {
      _overrideReason = reasonInput.value;
      if (reasonDisp) reasonDisp.textContent = reasonInput.value ? `（${reasonInput.value}）` : '';
    });

    // プリセットボタン
    document.querySelectorAll('.override-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = parseInt(btn.dataset.value);
        slider.value = val;
        _updateOverrideBadge(val);
        slider.dispatchEvent(new Event('input'));
      });
    });

    _updateOverrideBadge(0);
  }

  // -------- 3. Ground Truth入力フォーム --------

  function _setupGroundTruthForm() {
    // ゾーン選択肢を追加
    const gtZone = document.getElementById('gt-zone');
    if (gtZone) {
      gtZone.innerHTML = _currentFacility.zones.map(z =>
        `<option value="${z.id}">${z.name}</option>`
      ).join('');
    }

    // 日時のデフォルト（直前の整時）
    const gtDt = document.getElementById('gt-datetime');
    if (gtDt) {
      const now = new Date();
      now.setMinutes(0, 0, 0);
      gtDt.value = now.toISOString().slice(0, 16);
    }

    // ゾーン変更時に予測値を自動補完
    gtZone?.addEventListener('change', _autofillPredictedLevel);
    document.getElementById('gt-datetime')?.addEventListener('change', _autofillPredictedLevel);

    // フォーム送信
    document.getElementById('ground-truth-form')?.addEventListener('submit', e => {
      e.preventDefault();
      const zoneId    = document.getElementById('gt-zone').value;
      const timestamp = new Date(document.getElementById('gt-datetime').value).getTime();
      const predicted = parseInt(document.getElementById('gt-predicted').value);
      const actual    = parseInt(document.getElementById('gt-actual').value);
      const source    = document.getElementById('gt-source').value;
      const notes     = document.getElementById('gt-notes').value;

      dataManager.saveGroundTruth({ zoneId, timestamp, predictedLevel: predicted, actualLevel: actual, source, notes });
      predictionEngine.clearCache();
      showToast('実績値を保存しました。AIのバイアス補正を更新しました', 'success');

      _renderGroundTruthHistory();
      _renderAccuracyPanel(_currentZoneId);

      // フォームリセット
      document.getElementById('gt-actual').value = '';
      document.getElementById('gt-notes').value = '';
      _autofillPredictedLevel();
    });

    _renderGroundTruthHistory();
  }

  /** 予測キャッシュから予測値を自動補完 */
  function _autofillPredictedLevel() {
    const zoneId = document.getElementById('gt-zone')?.value;
    const dtStr  = document.getElementById('gt-datetime')?.value;
    const predInput = document.getElementById('gt-predicted');
    if (!zoneId || !dtStr || !predInput) return;

    const ts   = new Date(dtStr).getTime();
    const hour = new Date(ts).getHours();
    const preds = _predictionResults[zoneId];
    if (!preds) return;

    const match = preds.find(p => p && new Date(p.targetTs).getHours() === hour);
    if (match) predInput.value = match.predictedLevel;
  }

  /** Ground Truth履歴リストを描画 */
  function _renderGroundTruthHistory() {
    const container = document.getElementById('gt-history-list');
    if (!container) return;

    const records = dataManager.getGroundTruth({ limit: 10 });
    const zoneMap = {};
    _currentFacility.zones.forEach(z => { zoneMap[z.id] = z.shortName || z.name; });

    const inlineEl = document.getElementById('gt-accuracy-inline');
    if (inlineEl) {
      const stats = predictionEngine.getAccuracyStats(null, 7);
      if (stats?.sampleCount > 0) {
        inlineEl.textContent = `精度 ${stats.accuracy}% / ${stats.sampleCount}件`;
        inlineEl.style.color = stats.accuracy >= 85 ? '#10b981' : '#f59e0b';
      } else {
        inlineEl.textContent = '';
      }
    }

    if (records.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>まだ実績値がありません</p></div>';
      return;
    }

    const srcLabel = { manual: '手動', pos: 'POS', iot: 'IoT' };
    container.innerHTML = records.map(r => {
      const err   = r.predictedLevel - r.actualLevel;
      const errColor = Math.abs(err) <= 5 ? '#10b981' : Math.abs(err) <= 15 ? '#f59e0b' : '#ef4444';
      return `
        <div class="gt-record-item">
          <span class="gt-zone">${zoneMap[r.zoneId] || r.zoneId}</span>
          <span class="gt-time">${formatDateTime(r.timestamp)}</span>
          <span class="gt-pred">予測 ${r.predictedLevel}%</span>
          <span class="gt-arrow">→</span>
          <span class="gt-actual">実績 ${r.actualLevel}%</span>
          <span class="gt-error" style="color:${errColor}">${err > 0 ? '+' : ''}${err}pt</span>
          <span class="gt-src">${srcLabel[r.source] || r.source}</span>
        </div>`;
    }).join('');
  }

  // -------- 自動収集 --------

  function _setupAutoCollector() {
    const btnStart  = document.getElementById('btn-ac-start');
    const btnStop   = document.getElementById('btn-ac-stop');
    const btnNow    = document.getElementById('btn-ac-now');
    const btnToggle = document.getElementById('btn-toggle-autocollect');

    btnStart?.addEventListener('click', async () => {
      const intervalMin = parseInt(document.getElementById('ac-interval')?.value || '30');
      await autoCollector.start(intervalMin * 60 * 1000);
      _updateAutoCollectUI(autoCollector.getStatus());
    });

    btnStop?.addEventListener('click', () => {
      autoCollector.stop();
      _updateAutoCollectUI(autoCollector.getStatus());
    });

    btnNow?.addEventListener('click', async () => {
      showToast('収集中...', 'info', 3000);
      btnNow.disabled = true;
      await autoCollector._collect();
      btnNow.disabled = false;
      _updateAutoCollectUI(autoCollector.getStatus());
      _renderDataTable();
      _refreshDashboard();
      showToast('収集完了', 'success');
    });

    autoCollector.onStatusChange(status => {
      _updateAutoCollectUI(status);
      _renderDataTable();
      _refreshDashboard();
    });
  }

  function _updateAutoCollectUI(status) {
    const badge   = document.getElementById('ac-status-badge');
    const lastEl  = document.getElementById('ac-last-collected');
    const totalEl = document.getElementById('ac-total-collected');
    const btnStart  = document.getElementById('btn-ac-start');
    const btnStop   = document.getElementById('btn-ac-stop');
    const btnToggle = document.getElementById('btn-toggle-autocollect');

    if (badge) {
      badge.textContent = status.isRunning ? '収集中' : '停止中';
      badge.className   = `ac-badge ${status.isRunning ? 'running' : 'stopped'}`;
    }
    if (lastEl) {
      lastEl.textContent = status.lastCollected
        ? new Date(status.lastCollected).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
        : '--';
    }
    if (totalEl) totalEl.textContent = `${status.totalCollected}件`;
    if (btnStart) btnStart.disabled = status.isRunning;
    if (btnStop)  btnStop.disabled  = !status.isRunning;
    if (btnToggle) {
      btnToggle.textContent = `🌐 自動収集: ${status.isRunning ? 'ON' : 'OFF'}`;
      btnToggle.style.background = status.isRunning ? '#10b981' : '';
    }

    _updateDataSourceStatus();
  }

  function _updateDataSourceStatus() {
    const weatherEl  = document.getElementById('ds-weather-status');
    const holidayEl  = document.getElementById('ds-holiday-status');
    if (weatherEl) {
      const ok = weatherClient.isDataAvailable();
      weatherEl.textContent  = ok ? '接続済み' : '待機中';
      weatherEl.className    = `ac-ds-status ${ok ? 'active' : 'pending'}`;
    }
    if (holidayEl) {
      const ok = holidayClient.isLoaded();
      holidayEl.textContent  = ok ? '取得済み' : '待機中';
      holidayEl.className    = `ac-ds-status ${ok ? 'active' : 'pending'}`;
    }
  }

  // -------- 公開API --------

  return {
    init,
    switchTab,
    selectZone(zoneId) {
      _currentZoneId = zoneId;
      floorPlan.setSelectedZone(zoneId);
      _updateSidebarSelection(zoneId);
      _refreshDashboard();
    },
    openSettings,
    closeSettings,
    runPrediction: _runPrediction
  };
})();

window.app = App;

// DOM準備後に初期化
document.addEventListener('DOMContentLoaded', () => App.init());
