/**
 * alert-manager.js - アラート生成・管理・UI表示
 * 予測データから行動推奨レコメンデーションを生成
 */

class AlertManager {
  constructor() {
    this.dataManager = null;
    this.predictionEngine = null;
    this._alertListEl = null;
    this._badgeEl = null;
    this._onAlertCallback = null;
  }

  init(dataManager, predictionEngine) {
    this.dataManager = dataManager;
    this.predictionEngine = predictionEngine;
    this._alertListEl = document.getElementById('alert-list');
    this._badgeEl = document.getElementById('alert-count');
    this._setupThresholdSliders();
    console.log('[AlertManager] 初期化完了');
  }

  /**
   * 予測データからアラートを生成してDataManagerに保存
   * @param {Array} allZonePredictions - { zoneId, predictions }[]
   */
  async generateFromPredictions(allZonePredictions) {
    const settings = this.dataManager.getSettings();
    const highThr = settings.highCrowdingThreshold || CONFIG.alerts.highCrowdingThreshold;
    const lowThr = settings.lowCrowdingThreshold || CONFIG.alerts.lowCrowdingThreshold;

    const newAlerts = [];

    for (const { zoneId, predictions } of allZonePredictions) {
      const zone = CONFIG.defaultFacility.zones.find(z => z.id === zoneId);
      if (!zone || !predictions) continue;

      const recommendations = this.predictionEngine.generateRecommendations(predictions, zone);

      for (const rec of recommendations) {
        const alert = {
          type: rec.type,
          severity: rec.severity,
          zoneId: rec.zone,
          zoneName: zone.name,
          targetTime: rec.time,
          message: rec.message,
          action: rec.action,
          factors: rec.factors || {}
        };
        const saved = this.dataManager.addAlert(alert);
        newAlerts.push(saved);
      }
    }

    this.refreshBadge();
    if (newAlerts.length > 0 && this._onAlertCallback) {
      this._onAlertCallback(newAlerts);
    }

    console.log(`[AlertManager] ${newAlerts.length}件のアラートを生成`);
    return newAlerts;
  }

  /**
   * アラートリストUIを更新
   */
  renderAlertList() {
    if (!this._alertListEl) return;
    const alerts = this.dataManager.getAlerts();

    if (alerts.length === 0) {
      this._alertListEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔔</div>
          <p>アラートはありません</p>
          <small>予測を実行するとアラートが生成されます</small>
        </div>`;
      return;
    }

    this._alertListEl.innerHTML = alerts.map(alert => `
      <div class="alert-item ${alert.isRead ? 'read' : 'unread'} severity-${alert.severity}" data-id="${alert.id}">
        <div class="alert-item-header">
          <span class="alert-severity-badge ${alert.severity}">${this._getSeverityLabel(alert.severity)}</span>
          <span class="alert-type-icon">${this._getTypeIcon(alert.type)}</span>
          <span class="alert-zone">${alert.zoneName || alert.zoneId}</span>
          <span class="alert-time">${this._formatAlertTime(alert.targetTime)}</span>
          ${!alert.isRead ? '<span class="unread-dot"></span>' : ''}
        </div>
        <div class="alert-item-message">${alert.message}</div>
        ${alert.action ? `
          <div class="alert-action">
            <span class="action-icon">💡</span>
            <span class="action-text">${alert.action}</span>
          </div>` : ''}
        ${alert.factors?.weatherInfo ? `
          <div class="alert-weather-tag">
            ${alert.factors.weatherInfo.icon} ${alert.factors.weatherInfo.description}
            （天気影響: ×${alert.factors.weatherMod?.toFixed(2) || '-'}）
          </div>` : ''}
        <button class="alert-dismiss" onclick="alertManager.dismissAlert('${alert.id}')">既読</button>
      </div>
    `).join('');
  }

  /**
   * レコメンデーションリストをダッシュボードに表示
   * @param {Array} recommendations - predictionEngine.generateRecommendations()の結果
   */
  renderRecommendations(recommendations, containerId = 'recommendations-list') {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!recommendations || recommendations.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🤖</div>
          <p>レコメンデーションを生成するには予測を実行してください</p>
        </div>`;
      return;
    }

    container.innerHTML = recommendations.map((rec, i) => `
      <div class="recommendation-card ${rec.type} ${rec.severity}">
        <div class="rec-header">
          <span class="rec-icon">${this._getTypeIcon(rec.type)}</span>
          <div class="rec-meta">
            <span class="rec-zone">${rec.zone}</span>
            <span class="rec-time">${this._formatAlertTime(rec.time)}</span>
          </div>
          <span class="rec-severity ${rec.severity}">${this._getSeverityLabel(rec.severity)}</span>
        </div>
        <div class="rec-message">${rec.message}</div>
        ${rec.action ? `
          <div class="rec-action">
            <span class="action-bullet">▶</span>
            <span>${rec.action}</span>
          </div>` : ''}
        ${rec.factors ? this._renderFactorTags(rec.factors) : ''}
      </div>
    `).join('');
  }

  /**
   * 単一アラートをバナー表示
   */
  showBanner(alert) {
    const banner = document.getElementById('alert-banner');
    const titleEl = document.getElementById('alert-banner-title');
    const msgEl = document.getElementById('alert-banner-message');
    if (!banner || !titleEl || !msgEl) return;

    titleEl.textContent = `${this._getTypeIcon(alert.type)} ${this._getSeverityLabel(alert.severity)}アラート`;
    msgEl.textContent = alert.message;
    banner.className = `alert-banner ${alert.severity}`;
    banner.classList.remove('hidden');

    // 10秒後に自動非表示
    setTimeout(() => banner.classList.add('hidden'), 10000);
  }

  dismissAlert(alertId) {
    this.dataManager.markAlertsAsRead([alertId]);
    this.refreshBadge();
    this.renderAlertList();
  }

  markAllRead() {
    this.dataManager.markAlertsAsRead();
    this.refreshBadge();
    this.renderAlertList();
  }

  refreshBadge() {
    const count = this.dataManager.getUnreadAlertCount();
    if (this._badgeEl) this._badgeEl.textContent = count;
    const unreadBadge = document.getElementById('unread-badge');
    if (unreadBadge) {
      unreadBadge.textContent = count;
      unreadBadge.classList.toggle('hidden', count === 0);
    }
  }

  onNewAlert(callback) {
    this._onAlertCallback = callback;
  }

  _setupThresholdSliders() {
    const settings = this.dataManager.getSettings();
    const highSlider = document.getElementById('threshold-high');
    const lowSlider = document.getElementById('threshold-low');
    const weatherSlider = document.getElementById('threshold-weather');

    if (highSlider) {
      highSlider.value = settings.highCrowdingThreshold || CONFIG.alerts.highCrowdingThreshold;
      document.getElementById('threshold-high-value').textContent = `${highSlider.value}%`;
      highSlider.addEventListener('input', e => {
        document.getElementById('threshold-high-value').textContent = `${e.target.value}%`;
      });
    }

    if (lowSlider) {
      lowSlider.value = settings.lowCrowdingThreshold || CONFIG.alerts.lowCrowdingThreshold;
      document.getElementById('threshold-low-value').textContent = `${lowSlider.value}%`;
      lowSlider.addEventListener('input', e => {
        document.getElementById('threshold-low-value').textContent = `${e.target.value}%`;
      });
    }

    if (weatherSlider) {
      weatherSlider.value = settings.weatherImpactThreshold || CONFIG.alerts.weatherImpactThreshold;
      document.getElementById('threshold-weather-value').textContent = `${weatherSlider.value}%変動`;
      weatherSlider.addEventListener('input', e => {
        document.getElementById('threshold-weather-value').textContent = `${e.target.value}%変動`;
      });
    }

    // 設定保存ボタン
    const saveBtn = document.getElementById('btn-save-thresholds');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const newSettings = {};
        if (highSlider) newSettings.highCrowdingThreshold = parseInt(highSlider.value);
        if (lowSlider) newSettings.lowCrowdingThreshold = parseInt(lowSlider.value);
        if (weatherSlider) newSettings.weatherImpactThreshold = parseInt(weatherSlider.value);
        this.dataManager.saveSettings(newSettings);
        showToast('アラート閾値を保存しました', 'success');
      });
    }
  }

  _renderFactorTags(factors) {
    const tags = [];
    if (factors.weatherMod && factors.weatherMod !== 1) {
      const pct = Math.round(Math.abs(1 - factors.weatherMod) * 100);
      const dir = factors.weatherMod > 1 ? '+' : '-';
      tags.push(`<span class="factor-tag weather">${factors.weatherInfo?.icon || '🌡'} 天気${dir}${pct}%</span>`);
    }
    if (factors.eventMod && factors.eventMod > 1) {
      const pct = Math.round((factors.eventMod - 1) * 100);
      tags.push(`<span class="factor-tag event">📅 イベント+${pct}%</span>`);
    }
    if (factors.dayTypeMod && Math.abs(1 - factors.dayTypeMod) > 0.05) {
      const pct = Math.round(Math.abs(1 - factors.dayTypeMod) * 100);
      const dir = factors.dayTypeMod > 1 ? '+' : '-';
      tags.push(`<span class="factor-tag daytype">📅 曜日補正${dir}${pct}%</span>`);
    }
    return tags.length > 0 ? `<div class="factor-tags">${tags.join('')}</div>` : '';
  }

  _getSeverityLabel(severity) {
    return { critical: '緊急', high: '高', warning: '注意', info: '情報', low: '低混雑', medium: '注意' }[severity] || '情報';
  }

  _getTypeIcon(type) {
    return {
      high_crowding: '🔴', low_crowding: '🟢', weather_impact: '🌧',
      event_impact: '🎉', recommendation: '💡', system: '⚙️'
    }[type] || '🔔';
  }

  _formatAlertTime(ts) {
    if (!ts) return '--';
    const d = new Date(ts);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);

    if (d.toDateString() === now.toDateString()) return `本日 ${formatTime(ts)}`;
    if (d.toDateString() === tomorrow.toDateString()) return `明日 ${formatTime(ts)}`;
    return formatDateTime(ts);
  }
}

/**
 * グローバルトースト通知関数
 */
function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ'}</span><span>${message}</span>`;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => container.removeChild(toast), 350);
  }, duration);
}

window.alertManager = new AlertManager();
window.showToast = showToast;
