/**
 * chart-manager.js - Chart.jsグラフ管理
 * 当日推移・24時間予測・影響因子分析を可視化
 */

class ChartManager {
  constructor() {
    this._charts = {};
    this._defaultOptions = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600 },
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { size: 12 } } },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#e2e8f0',
          bodyColor: '#94a3b8',
          borderColor: '#334155',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8
        }
      },
      scales: {
        x: {
          ticks: { color: '#94a3b8', maxTicksLimit: 12, font: { size: 11 } },
          grid: { color: 'rgba(51, 65, 85, 0.4)' }
        },
        y: {
          min: 0, max: 100,
          ticks: { color: '#94a3b8', stepSize: 20, font: { size: 11 },
            callback: v => `${v}%` },
          grid: { color: 'rgba(51, 65, 85, 0.4)' }
        }
      }
    };
  }

  _destroyChart(id) {
    if (this._charts[id]) {
      this._charts[id].destroy();
      delete this._charts[id];
    }
  }

  _mergeDeep(target, source) {
    const result = { ...target };
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this._mergeDeep(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  /**
   * 当日の実績混雑推移グラフ
   */
  renderTodayTrend(canvasId, records, zoneName) {
    this._destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const sorted = [...records].sort((a, b) => a.timestamp - b.timestamp);
    const labels = sorted.map(r => formatTime(r.timestamp));
    const data = sorted.map(r => r.crowdingLevel);

    const openHour = CONFIG.defaultFacility.openHour || 9;
    const closeHour = CONFIG.defaultFacility.closeHour || 22;

    this._charts[canvasId] = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: `${zoneName} 混雑度`,
          data,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.15)',
          fill: true,
          tension: 0.4,
          pointRadius: data.length <= 24 ? 4 : 2,
          pointBackgroundColor: data.map(v => getCrowdingColor(v)),
          borderWidth: 2,
        }]
      },
      options: this._mergeDeep(this._defaultOptions, {
        plugins: {
          tooltip: {
            callbacks: {
              label: ctx => `混雑度: ${ctx.parsed.y}% (${getCrowdingLabel(ctx.parsed.y)})`
            }
          },
          annotation: {}
        }
      })
    });
  }

  /**
   * 24時間予測グラフ（実績 + 予測の重ね合わせ）
   */
  renderPredictionChart(canvasId, predictions, todayRecords = []) {
    this._destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

    // 実績データを時間インデックスにマップ
    const actualMap = {};
    for (const r of todayRecords) {
      const h = new Date(r.timestamp).getHours();
      if (!actualMap[h] || r.timestamp > actualMap[h].timestamp) actualMap[h] = r;
    }
    const actualData = hours.map((_, i) => actualMap[i] ? actualMap[i].crowdingLevel : null);

    // 予測データ
    const predMap = {};
    for (const p of predictions) {
      if (p && p.targetTs) predMap[new Date(p.targetTs).getHours()] = p.predictedLevel;
    }
    const predData = hours.map((_, i) => predMap[i] !== undefined ? predMap[i] : null);

    // 信頼区間（予測±標準偏差の近似）
    const upperData = hours.map((_, i) => predMap[i] !== undefined ? Math.min(100, predMap[i] * 1.12) : null);
    const lowerData = hours.map((_, i) => predMap[i] !== undefined ? Math.max(0, predMap[i] * 0.88) : null);

    // 危険域ゾーン（80%以上）
    const highZoneData = hours.map(() => 80);

    this._charts[canvasId] = new Chart(canvas, {
      type: 'line',
      data: {
        labels: hours,
        datasets: [
          {
            label: '実績',
            data: actualData,
            borderColor: '#10b981',
            backgroundColor: 'transparent',
            borderWidth: 2.5,
            pointRadius: 5,
            pointBackgroundColor: '#10b981',
            spanGaps: true,
            order: 1
          },
          {
            label: 'AI予測',
            data: predData,
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.08)',
            borderWidth: 2,
            borderDash: [5, 4],
            fill: false,
            pointRadius: 3,
            spanGaps: true,
            order: 2
          },
          {
            label: '信頼区間（上限）',
            data: upperData,
            borderColor: 'rgba(99, 102, 241, 0.2)',
            backgroundColor: 'rgba(99, 102, 241, 0.08)',
            borderWidth: 1,
            fill: '+1',
            pointRadius: 0,
            spanGaps: true,
            order: 3
          },
          {
            label: '信頼区間（下限）',
            data: lowerData,
            borderColor: 'rgba(99, 102, 241, 0.2)',
            backgroundColor: 'rgba(99, 102, 241, 0.08)',
            borderWidth: 1,
            fill: false,
            pointRadius: 0,
            spanGaps: true,
            order: 4
          },
          {
            label: '高混雑閾値(80%)',
            data: highZoneData,
            borderColor: 'rgba(239, 68, 68, 0.4)',
            backgroundColor: 'transparent',
            borderWidth: 1,
            borderDash: [8, 4],
            pointRadius: 0,
            order: 5
          }
        ]
      },
      options: this._mergeDeep(this._defaultOptions, {
        plugins: {
          tooltip: {
            callbacks: {
              title: ctx => `${ctx[0].label}`,
              label: ctx => {
                if (ctx.dataset.label === '実績') return `実績: ${ctx.parsed.y}%`;
                if (ctx.dataset.label === 'AI予測') return `予測: ${ctx.parsed.y}%`;
                return null;
              },
              afterBody: ctx => {
                const h = parseInt(ctx[0].label);
                const p = predictions.find(p => p && new Date(p.targetTs).getHours() === h);
                if (!p?.factors) return [];
                return [
                  '',
                  `天気影響: ×${p.factors.weatherMod}`,
                  `イベント影響: ×${p.factors.eventMod}`,
                  `曜日補正: ×${p.factors.dayTypeMod}`,
                ];
              }
            }
          }
        }
      })
    });
  }

  /**
   * 影響因子レーダーチャート
   */
  renderFactorChart(canvasId, factors) {
    this._destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const weatherPct = Math.round(Math.abs(1 - (factors.weatherMod || 1)) * 100);
    const eventPct = Math.round(Math.abs(1 - (factors.eventMod || 1)) * 100);
    const dayTypePct = Math.round(Math.abs(1 - (factors.dayTypeMod || 1)) * 100);
    const basePct = factors.historicalBase || 50;

    this._charts[canvasId] = new Chart(canvas, {
      type: 'radar',
      data: {
        labels: ['基本パターン', '天気影響', 'イベント影響', '曜日補正', '施設特性'],
        datasets: [{
          label: '影響度',
          data: [basePct, weatherPct, eventPct, dayTypePct, 30],
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.2)',
          pointBackgroundColor: '#6366f1',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          r: {
            min: 0, max: 100,
            ticks: { color: '#94a3b8', stepSize: 25, backdropColor: 'transparent', font: { size: 10 } },
            grid: { color: 'rgba(51, 65, 85, 0.5)' },
            pointLabels: { color: '#94a3b8', font: { size: 11 } }
          }
        }
      }
    });
  }

  /**
   * 週間混雑予測ヒートマップ（7日×24時間）
   * 棒グラフで代替表示
   */
  renderWeeklyForecast(canvasId, weeklyData) {
    this._destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const labels = weeklyData.map(d => {
      const date = new Date(d.date);
      return `${DAY_NAMES_JA[date.getDay()]}曜`;
    });
    const avgData = weeklyData.map(d => d.avgPredicted);
    const maxData = weeklyData.map(d => d.maxPredicted);

    this._charts[canvasId] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: '平均混雑度',
            data: avgData,
            backgroundColor: avgData.map(v => `${getCrowdingColor(v)}99`),
            borderColor: avgData.map(v => getCrowdingColor(v)),
            borderWidth: 1.5,
            borderRadius: 6,
          },
          {
            label: 'ピーク混雑度',
            data: maxData,
            backgroundColor: 'transparent',
            borderColor: '#f59e0b',
            borderWidth: 2,
            type: 'line',
            pointRadius: 5,
            pointBackgroundColor: '#f59e0b',
            tension: 0.3,
            fill: false
          }
        ]
      },
      options: this._mergeDeep(this._defaultOptions, {
        plugins: {
          tooltip: {
            callbacks: {
              afterLabel: ctx => `（${getCrowdingLabel(ctx.parsed.y)}）`
            }
          }
        }
      })
    });
  }

  destroyAll() {
    for (const id in this._charts) this._destroyChart(id);
  }
}

window.chartManager = new ChartManager();
