/**
 * config.js - アプリケーション設定・デフォルト施設データ
 * マイクロロケーション混雑予測AIシステム - CrowdSense Pro
 */

const CONFIG = {
  version: '1.0.0',
  appName: 'CrowdSense Pro',

  // デフォルト施設（サンプルショッピングモール）
  defaultFacility: {
    id: 'facility_001',
    name: 'サンプルショッピングモール',
    address: '東京都渋谷区神南1-19-14',
    lat: 35.6580,
    lng: 139.7016,
    timezone: 'Asia/Tokyo',
    openHour: 9,
    closeHour: 22,
    // ゾーン定義（SVG座標: 1000×600 viewport基準）
    zones: [
      {
        id: 'zone_entrance_a',
        name: '北口エントランス',
        shortName: '北口',
        type: 'entrance',
        isIndoor: false,
        capacity: 500,
        // SVG floor plan position (x, y, width, height)
        svgX: 380, svgY: 10, svgW: 240, svgH: 65,
        color: '#8b5cf6'
      },
      {
        id: 'zone_food_court',
        name: 'フードコート',
        shortName: 'フード',
        type: 'food_court',
        isIndoor: true,
        capacity: 300,
        svgX: 30, svgY: 120, svgW: 300, svgH: 160,
        color: '#f59e0b'
      },
      {
        id: 'zone_clothing',
        name: '衣料品フロア',
        shortName: '衣料品',
        type: 'retail',
        isIndoor: true,
        capacity: 400,
        svgX: 670, svgY: 120, svgW: 300, svgH: 160,
        color: '#3b82f6'
      },
      {
        id: 'zone_service',
        name: 'サービスカウンター',
        shortName: 'サービス',
        type: 'service',
        isIndoor: true,
        capacity: 80,
        svgX: 370, svgY: 200, svgW: 260, svgH: 90,
        color: '#06b6d4'
      },
      {
        id: 'zone_checkout',
        name: 'レジエリア',
        shortName: 'レジ',
        type: 'checkout',
        isIndoor: true,
        capacity: 150,
        svgX: 30, svgY: 340, svgW: 260, svgH: 110,
        color: '#ec4899'
      },
      {
        id: 'zone_electronics',
        name: '電化製品フロア',
        shortName: '電化製品',
        type: 'retail',
        isIndoor: true,
        capacity: 350,
        svgX: 670, svgY: 340, svgW: 300, svgH: 110,
        color: '#10b981'
      },
      {
        id: 'zone_rest',
        name: '休憩エリア',
        shortName: '休憩',
        type: 'rest',
        isIndoor: true,
        capacity: 120,
        svgX: 340, svgY: 340, svgW: 280, svgH: 110,
        color: '#64748b'
      },
      {
        id: 'zone_entrance_b',
        name: '南口エントランス',
        shortName: '南口',
        type: 'entrance',
        isIndoor: false,
        capacity: 450,
        svgX: 380, svgY: 525, svgW: 240, svgH: 65,
        color: '#8b5cf6'
      }
    ]
  },

  // 予測エンジン設定
  prediction: {
    lookbackWeeks: 4,          // 過去何週分の同曜日データを参照するか
    minDataPoints: 3,           // 予測に必要な最小データポイント数
    defaultConfidence: 0.5,    // データが少ない場合のデフォルト信頼度
    hourlyGranularity: 1,       // 時間粒度（時間単位）
  },

  // アラート閾値
  alerts: {
    highCrowdingThreshold: 80,   // 高混雑アラート（%）
    lowCrowdingThreshold: 20,    // 低混雑アラート（%）
    weatherImpactThreshold: 20,  // 天気影響アラート（変動%）
    eventImpactThreshold: 30,    // イベント影響アラート（変動%）
  },

  // 天気API設定（Open-Meteo: 無料・APIキー不要）
  weather: {
    apiBase: 'https://api.open-meteo.com/v1',
    forecastDays: 7,
    updateIntervalMs: 30 * 60 * 1000, // 30分
  },

  // カラーパレット（混雑レベル別）
  crowdingColors: {
    low:      { bg: '#10b981', text: '#064e3b', label: '低（0-30%）' },
    moderate: { bg: '#f59e0b', text: '#78350f', label: '普通（31-60%）' },
    high:     { bg: '#f97316', text: '#7c2d12', label: '高（61-80%）' },
    critical: { bg: '#ef4444', text: '#7f1d1d', label: '混雑（81-100%）' },
  },

  // ゾーンタイプ別パターン係数
  zoneTypePatterns: {
    entrance:   { peakMultiplier: 1.0, lunchBoost: 0.7, eveningBoost: 1.2 },
    food_court: { peakMultiplier: 1.4, lunchBoost: 2.0, eveningBoost: 1.5 },
    checkout:   { peakMultiplier: 1.1, lunchBoost: 0.9, eveningBoost: 1.6 },
    retail:     { peakMultiplier: 1.0, lunchBoost: 0.8, eveningBoost: 1.3 },
    service:    { peakMultiplier: 0.8, lunchBoost: 0.6, eveningBoost: 0.7 },
    rest:       { peakMultiplier: 0.6, lunchBoost: 1.2, eveningBoost: 0.9 },
  },

  // UIテーマ
  theme: {
    primary: '#6366f1',
    primaryDark: '#4338ca',
    bg: '#0f172a',
    bgCard: '#1e293b',
    bgCardHover: '#2d3f55',
    border: '#334155',
    text: '#e2e8f0',
    textMuted: '#94a3b8',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#06b6d4',
  }
};

// 混雑レベルをカテゴリーに変換
function getCrowdingCategory(level) {
  if (level <= 30) return 'low';
  if (level <= 60) return 'moderate';
  if (level <= 80) return 'high';
  return 'critical';
}

// 混雑レベルをカラーに変換
function getCrowdingColor(level) {
  const cat = getCrowdingCategory(level);
  return CONFIG.crowdingColors[cat].bg;
}

// 混雑レベルを日本語ラベルに変換
function getCrowdingLabel(level) {
  if (level <= 30) return '空いています';
  if (level <= 60) return '普通';
  if (level <= 80) return '混雑';
  return '大混雑';
}

// 日時フォーマット
function formatDateTime(ts) {
  const d = new Date(ts);
  return d.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
}

const DAY_NAMES_JA = ['日', '月', '火', '水', '木', '金', '土'];

// グローバルに公開
window.CONFIG = CONFIG;
window.getCrowdingCategory = getCrowdingCategory;
window.getCrowdingColor = getCrowdingColor;
window.getCrowdingLabel = getCrowdingLabel;
window.formatDateTime = formatDateTime;
window.formatTime = formatTime;
window.formatDate = formatDate;
window.DAY_NAMES_JA = DAY_NAMES_JA;
