/**
 * config.js - アプリケーション設定
 * 対象エリア: 上野公園（東京都台東区）マイクロロケーション
 * CrowdSense Pro v2.0
 */

const CONFIG = {
  version: '2.0.0',
  appName: 'CrowdSense Pro',

  // 上野公園エリア施設設定
  defaultFacility: {
    id: 'ueno_park',
    name: '上野公園エリア',
    address: '東京都台東区上野公園',
    lat: 35.7130,
    lng: 139.7730,
    timezone: 'Asia/Tokyo',
    openHour: 6,
    closeHour: 23,

    // マイクロロケーション・ゾーン（実際の緯度経度）
    zones: [
      {
        id: 'zone_zoo_cafe',
        name: '動物園表門付近のカフェ',
        shortName: '動物園カフェ',
        type: 'cafe',
        isIndoor: true,
        closedOnMonday: false,
        capacity: 80,
        lat: 35.7148, lng: 139.7713,
        color: '#f59e0b',
        mapRadius: 35,
        svgX: 170, svgY: 140, svgW: 210, svgH: 100
      },
      {
        id: 'zone_art_museum',
        name: '東京都美術館周辺',
        shortName: '都美術館',
        type: 'museum',
        isIndoor: false,
        closedOnMonday: true,
        capacity: 350,
        lat: 35.7175, lng: 139.7726,
        color: '#3b82f6',
        mapRadius: 50,
        svgX: 580, svgY: 85, svgW: 270, svgH: 120
      },
      {
        id: 'zone_national_museum',
        name: '東京国立博物館',
        shortName: '国立博物館',
        type: 'museum',
        isIndoor: true,
        closedOnMonday: true,
        capacity: 500,
        lat: 35.7191, lng: 139.7759,
        color: '#8b5cf6',
        mapRadius: 60,
        svgX: 575, svgY: 235, svgW: 275, svgH: 130
      },
      {
        id: 'zone_sakura_path',
        name: '桜並木・お花見エリア',
        shortName: '桜並木',
        type: 'park',
        isIndoor: false,
        closedOnMonday: false,
        capacity: 1200,
        lat: 35.7131, lng: 139.7739,
        color: '#ec4899',
        mapRadius: 75,
        svgX: 330, svgY: 190, svgW: 200, svgH: 90
      },
      {
        id: 'zone_shinobazu_boat',
        name: '不忍池ボート乗り場付近',
        shortName: '不忍池',
        type: 'leisure',
        isIndoor: false,
        closedOnMonday: false,
        capacity: 200,
        lat: 35.7097, lng: 139.7706,
        color: '#06b6d4',
        mapRadius: 45,
        svgX: 115, svgY: 395, svgW: 230, svgH: 120
      },
      {
        id: 'zone_toshogu',
        name: '上野東照宮・ぼたん苑',
        shortName: '東照宮',
        type: 'shrine',
        isIndoor: false,
        closedOnMonday: false,
        capacity: 300,
        lat: 35.7162, lng: 139.7740,
        color: '#10b981',
        mapRadius: 40,
        svgX: 390, svgY: 320, svgW: 210, svgH: 100
      },
      {
        id: 'zone_ameyoko',
        name: 'アメ横商店街',
        shortName: 'アメ横',
        type: 'market',
        isIndoor: false,
        closedOnMonday: false,
        capacity: 800,
        lat: 35.7079, lng: 139.7756,
        color: '#ef4444',
        mapRadius: 50,
        svgX: 620, svgY: 405, svgW: 245, svgH: 120
      }
    ]
  },

  // 上野公園固有の季節・定期イベント定義
  uenoSeasons: {
    cherry_blossom: {
      startMD: [3, 20], peakStartMD: [3, 28], peakEndMD: [4, 7], endMD: [4, 15],
      peakMultiplier: 3.8,
      normalMultiplier: 2.1,
      label: '桜シーズン',
      icon: '🌸'
    },
    botan_spring: {
      startMD: [4, 10], endMD: [5, 10],
      multiplier: 1.5,
      affectedZones: ['zone_toshogu'],
      label: 'ぼたん祭り（春）',
      icon: '🌺'
    },
    lotus_summer: {
      startMD: [7, 1], endMD: [8, 31],
      multiplier: 1.35,
      affectedZones: ['zone_shinobazu_boat'],
      label: '不忍池・蓮の開花',
      icon: '🪷'
    },
    autumn_leaves: {
      startMD: [10, 25], endMD: [11, 30],
      multiplier: 1.5,
      label: '紅葉シーズン',
      icon: '🍂'
    },
    botan_winter: {
      startMD: [1, 1], endMD: [2, 20],
      multiplier: 1.3,
      affectedZones: ['zone_toshogu'],
      label: 'ぼたん祭り（冬）',
      icon: '🌸'
    },
    ameyoko_newyear: {
      startMD: [12, 27], endMD: [12, 31],
      multiplier: 3.0,
      affectedZones: ['zone_ameyoko'],
      label: '年末アメ横',
      icon: '🎍'
    }
  },

  // 美術館月曜休館の影響係数
  museumMondayEffect: 0.18,

  // 予測エンジン設定
  prediction: {
    lookbackWeeks: 8,
    minDataPoints: 2,
    defaultConfidence: 0.45,
  },

  // アラート閾値
  alerts: {
    highCrowdingThreshold: 80,
    lowCrowdingThreshold: 20,
    weatherImpactThreshold: 20,
    eventImpactThreshold: 30,
  },

  // 天気API（Open-Meteo: 無料・APIキー不要）
  weather: {
    apiBase: 'https://api.open-meteo.com/v1',
    forecastDays: 7,
    updateIntervalMs: 30 * 60 * 1000,
  },

  // 混雑レベルカラー
  crowdingColors: {
    low:      { bg: '#10b981', label: '空き' },
    moderate: { bg: '#f59e0b', label: '普通' },
    high:     { bg: '#f97316', label: '混雑' },
    critical: { bg: '#ef4444', label: '大混雑' },
  },

  // Leaflet地図設定
  map: {
    center: [35.7130, 139.7730],
    zoom: 16,
    tileUrl: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    tileAttribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  }
};

// -------- ユーティリティ --------

function getCrowdingCategory(level) {
  if (level <= 30) return 'low';
  if (level <= 60) return 'moderate';
  if (level <= 80) return 'high';
  return 'critical';
}

function getCrowdingColor(level) {
  return CONFIG.crowdingColors[getCrowdingCategory(level)].bg;
}

function getCrowdingLabel(level) {
  if (level <= 30) return '空いています';
  if (level <= 60) return '普通';
  if (level <= 80) return '混雑';
  return '大混雑';
}

function formatDateTime(ts) {
  return new Date(ts).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}
function formatDate(ts) {
  return new Date(ts).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
}
function formatDateShort(ts) {
  return new Date(ts).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' });
}

const DAY_NAMES_JA = ['日', '月', '火', '水', '木', '金', '土'];

window.CONFIG = CONFIG;
window.getCrowdingCategory = getCrowdingCategory;
window.getCrowdingColor = getCrowdingColor;
window.getCrowdingLabel = getCrowdingLabel;
window.formatDateTime = formatDateTime;
window.formatTime = formatTime;
window.formatDate = formatDate;
window.formatDateShort = formatDateShort;
window.DAY_NAMES_JA = DAY_NAMES_JA;
