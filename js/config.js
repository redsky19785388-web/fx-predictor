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

// ================================================================
// 追加エリア施設定義
// ================================================================

const FACILITY_SHINJUKU = {
  id: 'shinjuku',
  name: '新宿エリア',
  address: '東京都新宿区新宿',
  lat: 35.6896,
  lng: 139.6917,
  timezone: 'Asia/Tokyo',
  openHour: 0,
  closeHour: 24,
  zones: [
    {
      id: 'shinjuku_kabukicho',
      name: '歌舞伎町・東口ナイトエリア',
      shortName: '歌舞伎町',
      type: 'entertainment',
      isIndoor: false,
      closedOnMonday: false,
      capacity: 3000,
      lat: 35.6938, lng: 139.7034,
      color: '#ef4444',
      mapRadius: 65
    },
    {
      id: 'shinjuku_business',
      name: '西口・高層ビジネス街',
      shortName: '西口ビジネス',
      type: 'office',
      isIndoor: true,
      closedOnMonday: false,
      capacity: 2000,
      lat: 35.6895, lng: 139.6866,
      color: '#3b82f6',
      mapRadius: 55
    },
    {
      id: 'shinjuku_gyoen',
      name: '新宿御苑',
      shortName: '新宿御苑',
      type: 'park',
      isIndoor: false,
      closedOnMonday: true,
      capacity: 1500,
      lat: 35.6852, lng: 139.7100,
      color: '#10b981',
      mapRadius: 60
    },
    {
      id: 'shinjuku_isetan',
      name: '新宿三丁目・伊勢丹周辺',
      shortName: '新宿三丁目',
      type: 'shopping',
      isIndoor: true,
      closedOnMonday: false,
      capacity: 1000,
      lat: 35.6920, lng: 139.7044,
      color: '#ec4899',
      mapRadius: 45
    },
    {
      id: 'shinjuku_southgate',
      name: '新宿南口・タカシマヤタイムズスクエア',
      shortName: '新宿南口',
      type: 'shopping',
      isIndoor: true,
      closedOnMonday: false,
      capacity: 900,
      lat: 35.6855, lng: 139.6997,
      color: '#8b5cf6',
      mapRadius: 40
    }
  ]
};

const FACILITY_SHIBUYA = {
  id: 'shibuya',
  name: '渋谷エリア',
  address: '東京都渋谷区道玄坂',
  lat: 35.6580,
  lng: 139.7016,
  timezone: 'Asia/Tokyo',
  openHour: 6,
  closeHour: 24,
  zones: [
    {
      id: 'shibuya_scramble',
      name: 'スクランブル交差点周辺',
      shortName: 'スクランブル',
      type: 'crossing',
      isIndoor: false,
      closedOnMonday: false,
      capacity: 3000,
      lat: 35.6595, lng: 139.7004,
      color: '#f59e0b',
      mapRadius: 55
    },
    {
      id: 'shibuya_center',
      name: 'センター街・渋谷109',
      shortName: 'センター街',
      type: 'shopping',
      isIndoor: true,
      closedOnMonday: false,
      capacity: 1200,
      lat: 35.6611, lng: 139.6993,
      color: '#ec4899',
      mapRadius: 45
    },
    {
      id: 'shibuya_hikarie',
      name: '渋谷ヒカリエ・東口',
      shortName: 'ヒカリエ',
      type: 'complex',
      isIndoor: true,
      closedOnMonday: false,
      capacity: 1000,
      lat: 35.6587, lng: 139.7034,
      color: '#6366f1',
      mapRadius: 40
    },
    {
      id: 'shibuya_stream',
      name: '渋谷ストリーム・南口',
      shortName: '渋谷南口',
      type: 'complex',
      isIndoor: true,
      closedOnMonday: false,
      capacity: 700,
      lat: 35.6560, lng: 139.7016,
      color: '#06b6d4',
      mapRadius: 38
    },
    {
      id: 'shibuya_catstreet',
      name: 'キャットストリート・神南エリア',
      shortName: 'キャットSt',
      type: 'park',
      isIndoor: false,
      closedOnMonday: false,
      capacity: 400,
      lat: 35.6638, lng: 139.7063,
      color: '#10b981',
      mapRadius: 35
    }
  ]
};

const FACILITY_IKEBUKURO = {
  id: 'ikebukuro',
  name: '池袋エリア',
  address: '東京都豊島区東池袋',
  lat: 35.7295,
  lng: 139.7110,
  timezone: 'Asia/Tokyo',
  openHour: 7,
  closeHour: 23,
  zones: [
    {
      id: 'ikebukuro_sunshine',
      name: 'サンシャインシティ・東口',
      shortName: 'サンシャイン',
      type: 'complex',
      isIndoor: true,
      closedOnMonday: false,
      capacity: 2000,
      lat: 35.7293, lng: 139.7187,
      color: '#f59e0b',
      mapRadius: 60
    },
    {
      id: 'ikebukuro_dept',
      name: '西武・東武デパート街',
      shortName: 'デパート街',
      type: 'shopping',
      isIndoor: true,
      closedOnMonday: false,
      capacity: 1500,
      lat: 35.7295, lng: 139.7105,
      color: '#3b82f6',
      mapRadius: 50
    },
    {
      id: 'ikebukuro_otome',
      name: '乙女ロード・アニメイト',
      shortName: '乙女ロード',
      type: 'specialty',
      isIndoor: true,
      closedOnMonday: false,
      capacity: 500,
      lat: 35.7325, lng: 139.7155,
      color: '#ec4899',
      mapRadius: 35
    },
    {
      id: 'ikebukuro_westpark',
      name: '池袋西口公園・東京芸術劇場',
      shortName: '西口公園',
      type: 'park',
      isIndoor: false,
      closedOnMonday: false,
      capacity: 600,
      lat: 35.7307, lng: 139.7079,
      color: '#10b981',
      mapRadius: 40
    },
    {
      id: 'ikebukuro_east',
      name: '池袋東口・グリーン大通り',
      shortName: '東口グリーン',
      type: 'entertainment',
      isIndoor: false,
      closedOnMonday: false,
      capacity: 800,
      lat: 35.7288, lng: 139.7142,
      color: '#8b5cf6',
      mapRadius: 42
    }
  ]
};

const FACILITY_ROPPONGI = {
  id: 'roppongi',
  name: '六本木エリア',
  address: '東京都港区六本木',
  lat: 35.6628,
  lng: 139.7314,
  timezone: 'Asia/Tokyo',
  openHour: 0,
  closeHour: 24,
  zones: [
    {
      id: 'roppongi_hills',
      name: '六本木ヒルズ・アリーナ',
      shortName: 'ヒルズ',
      type: 'complex',
      isIndoor: true,
      closedOnMonday: false,
      capacity: 1500,
      lat: 35.6604, lng: 139.7292,
      color: '#6366f1',
      mapRadius: 55
    },
    {
      id: 'roppongi_midtown',
      name: '東京ミッドタウン',
      shortName: 'ミッドタウン',
      type: 'complex',
      isIndoor: true,
      closedOnMonday: false,
      capacity: 1200,
      lat: 35.6657, lng: 139.7310,
      color: '#3b82f6',
      mapRadius: 48
    },
    {
      id: 'roppongi_nact',
      name: '国立新美術館',
      shortName: '新美術館',
      type: 'museum',
      isIndoor: true,
      closedOnMonday: false,
      closedOnTuesday: true,
      capacity: 800,
      lat: 35.6652, lng: 139.7271,
      color: '#10b981',
      mapRadius: 42
    },
    {
      id: 'roppongi_crossing',
      name: '六本木交差点・ナイトライフ',
      shortName: '六本木交差点',
      type: 'entertainment',
      isIndoor: false,
      closedOnMonday: false,
      capacity: 2000,
      lat: 35.6627, lng: 139.7315,
      color: '#ef4444',
      mapRadius: 50
    },
    {
      id: 'roppongi_keyakizaka',
      name: 'けやき坂・ヒルズアレー',
      shortName: 'けやき坂',
      type: 'park',
      isIndoor: false,
      closedOnMonday: false,
      capacity: 500,
      lat: 35.6594, lng: 139.7315,
      color: '#f59e0b',
      mapRadius: 38
    }
  ]
};

// 全施設リスト（施設切り替えで参照）
CONFIG.allFacilities = [
  { ...CONFIG.defaultFacility },
  FACILITY_SHINJUKU,
  FACILITY_SHIBUYA,
  FACILITY_IKEBUKURO,
  FACILITY_ROPPONGI
];

// 施設別 地図中心座標
CONFIG.facilityMapCenters = {
  ueno_park:  { center: [35.7130, 139.7730], zoom: 16 },
  shinjuku:   { center: [35.6896, 139.6917], zoom: 15 },
  shibuya:    { center: [35.6585, 139.7016], zoom: 15 },
  ikebukuro:  { center: [35.7295, 139.7110], zoom: 15 },
  roppongi:   { center: [35.6628, 139.7314], zoom: 15 }
};

window.FACILITY_SHINJUKU  = FACILITY_SHINJUKU;
window.FACILITY_SHIBUYA   = FACILITY_SHIBUYA;
window.FACILITY_IKEBUKURO = FACILITY_IKEBUKURO;
window.FACILITY_ROPPONGI  = FACILITY_ROPPONGI;

