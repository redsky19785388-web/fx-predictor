/**
 * realtime-context.js - リアルタイム・コンテキスト統合（モック実装）
 * 交通機関の運行状況、近隣施設の混雑、SNSトレンドをシミュレート
 * エリア別に対応（上野・新宿・渋谷・池袋・六本木）
 * CrowdSense Pro v3.0
 */

const RealtimeContext = (function () {

  // -------- エリア別 交通路線定義 --------

  const TRANSIT_BY_AREA = {
    ueno_park: [
      { id: 'jr_yamanote',    name: 'JR山手線',           icon: '🟢', type: 'jr' },
      { id: 'jr_ueno_tokyo',  name: 'JR上野東京ライン',    icon: '🔵', type: 'jr' },
      { id: 'metro_hibiya',   name: '東京メトロ日比谷線',  icon: '🟤', type: 'metro' },
      { id: 'metro_ginza',    name: '東京メトロ銀座線',    icon: '🟡', type: 'metro' },
      { id: 'keisei',         name: '京成線',              icon: '🔴', type: 'private' }
    ],
    shinjuku: [
      { id: 'jr_yamanote',      name: 'JR山手線',             icon: '🟢', type: 'jr' },
      { id: 'jr_chuo',          name: 'JR中央線・総武線',      icon: '🔵', type: 'jr' },
      { id: 'odakyu',           name: '小田急線',              icon: '🟣', type: 'private' },
      { id: 'keio',             name: '京王線',                icon: '🟤', type: 'private' },
      { id: 'metro_marunouchi', name: '東京メトロ丸ノ内線',    icon: '🔴', type: 'metro' }
    ],
    shibuya: [
      { id: 'jr_yamanote',      name: 'JR山手線',             icon: '🟢', type: 'jr' },
      { id: 'jr_saikyo',        name: 'JR埼京線・湘南新宿ライン', icon: '🔵', type: 'jr' },
      { id: 'tokyu_toyoko',     name: '東急東横線',            icon: '🔴', type: 'private' },
      { id: 'tokyu_denentoshi', name: '東急田園都市線',        icon: '🟤', type: 'private' },
      { id: 'metro_hanzomon',   name: '東京メトロ半蔵門線',    icon: '🟣', type: 'metro' }
    ],
    ikebukuro: [
      { id: 'jr_yamanote',       name: 'JR山手線',             icon: '🟢', type: 'jr' },
      { id: 'jr_saikyo',         name: 'JR埼京線・湘南新宿ライン', icon: '🔵', type: 'jr' },
      { id: 'tobu_tojo',         name: '東武東上線',           icon: '🟣', type: 'private' },
      { id: 'seibu_ikebukuro',   name: '西武池袋線',           icon: '🟡', type: 'private' },
      { id: 'metro_marunouchi',  name: '東京メトロ丸ノ内線',   icon: '🔴', type: 'metro' }
    ],
    roppongi: [
      { id: 'metro_hibiya',   name: '東京メトロ日比谷線',  icon: '🟤', type: 'metro' },
      { id: 'toei_oedo',      name: '都営大江戸線',         icon: '🟣', type: 'metro' },
      { id: 'metro_namboku',  name: '東京メトロ南北線',     icon: '🔵', type: 'metro' },
      { id: 'metro_chiyoda',  name: '東京メトロ千代田線',   icon: '🟢', type: 'metro' },
      { id: 'toei_mita',      name: '都営三田線',           icon: '🔴', type: 'metro' }
    ]
  };

  // -------- エリア別 近隣施設 --------

  const NEARBY_BY_AREA = {
    ueno_park: [
      { id: 'ueno_zoo',        name: '上野動物園',       icon: '🐼',
        hourBases: [10,10,10,10,10,10,15,20,35,55,65,70,75,80,78,72,60,40,25,15,10,10,10,10] },
      { id: 'national_museum', name: '東京国立博物館',   icon: '🏛️',
        hourBases: [10,10,10,10,10,10,10,15,25,45,60,65,60,55,50,45,35,20,10,10,10,10,10,10] },
      { id: 'western_art',     name: '国立西洋美術館',   icon: '🎨',
        hourBases: [10,10,10,10,10,10,10,15,20,40,55,60,55,50,45,40,30,15,10,10,10,10,10,10] },
      { id: 'akihabara',       name: '秋葉原エリア',     icon: '💻',
        hourBases: [10,10,10,10,10,10,15,25,30,40,50,55,60,65,70,75,78,80,72,60,45,30,20,12] }
    ],
    shinjuku: [
      { id: 'kabukicho',       name: '歌舞伎町',         icon: '🎭',
        hourBases: [40,30,20,10,5,3,3,10,20,30,40,50,55,55,55,60,70,80,90,95,95,90,80,65] },
      { id: 'odakyu_dept',     name: '小田急百貨店',     icon: '🏬',
        hourBases: [5,5,5,5,5,5,5,5,10,40,65,70,70,65,68,75,80,78,70,55,35,15,8,5] },
      { id: 'isetan',          name: '伊勢丹新宿',       icon: '👗',
        hourBases: [5,5,5,5,5,5,5,5,10,40,70,75,72,68,70,78,82,80,72,58,38,18,8,5] },
      { id: 'shinjuku_gyoen',  name: '新宿御苑',         icon: '🌿',
        hourBases: [5,5,5,5,5,5,5,8,20,45,62,68,65,62,65,68,60,45,25,10,5,5,5,5] }
    ],
    shibuya: [
      { id: 'shibuya109',      name: '渋谷109',          icon: '👟',
        hourBases: [5,5,5,5,5,5,5,5,10,35,60,70,72,68,68,74,80,82,78,65,45,25,12,6] },
      { id: 'bunkamura',       name: 'Bunkamura',        icon: '🎭',
        hourBases: [5,5,5,5,5,5,5,5,15,30,45,55,55,52,55,60,65,70,68,55,38,20,10,5] },
      { id: 'daikanyama',      name: '代官山エリア',     icon: '☕',
        hourBases: [5,5,5,5,5,5,5,8,18,35,55,65,68,66,66,70,74,76,70,58,40,22,12,6] },
      { id: 'harajuku',        name: '原宿・竹下通り',   icon: '🛍️',
        hourBases: [5,5,5,5,5,5,5,8,20,45,68,78,80,78,78,82,84,82,74,60,42,22,12,5] }
    ],
    ikebukuro: [
      { id: 'sunshine_city',   name: 'サンシャインシティ', icon: '🌟',
        hourBases: [5,5,5,5,5,5,5,8,20,48,65,72,72,68,70,76,80,78,70,56,38,20,10,5] },
      { id: 'seibu_dept',      name: '西武百貨店',       icon: '🏬',
        hourBases: [5,5,5,5,5,5,5,5,10,42,65,72,70,65,68,76,80,78,68,52,32,15,7,5] },
      { id: 'tobu_dept',       name: '東武百貨店',       icon: '🏬',
        hourBases: [5,5,5,5,5,5,5,5,10,40,63,70,68,63,66,74,78,76,66,50,30,14,7,5] },
      { id: 'animate_ikebukuro','name': 'アニメイト池袋', icon: '🎌',
        hourBases: [5,5,5,5,5,5,5,5,8,25,45,58,65,68,72,78,82,80,70,55,35,15,8,5] }
    ],
    roppongi: [
      { id: 'roppongi_hills_museum', name: '森美術館',     icon: '🎨',
        hourBases: [5,5,5,5,5,5,5,5,5,20,45,58,60,58,58,62,65,68,72,72,68,60,45,25] },
      { id: 'midtown_design',  name: 'ミッドタウン',      icon: '🏙️',
        hourBases: [5,5,5,5,5,5,5,8,15,35,55,65,65,62,62,66,72,76,72,60,42,22,12,6] },
      { id: 'azabu_juban',     name: '麻布十番',          icon: '🍜',
        hourBases: [5,5,5,5,5,5,5,8,15,28,42,52,55,52,52,56,65,75,80,78,70,55,38,20] },
      { id: 'roppongi_club',   name: 'クラブ街',          icon: '🎵',
        hourBases: [50,65,70,60,40,20,5,3,3,5,8,10,12,12,10,12,18,28,45,65,80,90,95,80] }
    ]
  };

  // -------- エリア別 SNSトピック --------

  const SNS_BY_AREA = {
    ueno_park: {
      spring:  ['#上野桜', '#花見2026', '#上野公園', '#cherry_blossom', '#お花見', '#sakura', '#上野春'],
      summer:  ['#上野動物園', '#不忍池', '#上野夏', '#蓮の花', '#夏休み上野', '#tokyo_summer'],
      autumn:  ['#上野紅葉', '#東京国立博物館', '#秋の上野', '#autumn_leaves', '#上野散歩'],
      winter:  ['#アメ横', '#年末年始', '#初詣上野', '#上野冬', '#ameyoko', '#tokyo_winter'],
      always:  ['#上野グルメ', '#東京観光', '#上野カフェ', '#ueno', '#tokyo_sightseeing']
    },
    shinjuku: {
      spring:  ['#新宿御苑桜', '#新宿花見', '#shinjuku_sakura', '#新宿春'],
      summer:  ['#新宿夏祭り', '#新宿歌舞伎町', '#shinjuku_night', '#新宿花火'],
      autumn:  ['#新宿紅葉', '#新宿御苑秋', '#shinjuku_autumn'],
      winter:  ['#新宿ルミネカウントダウン', '#年末新宿', '#新宿イルミネーション'],
      always:  ['#新宿グルメ', '#shinjuku', '#新宿カフェ', '#歌舞伎町', '#新宿散歩', '#西新宿']
    },
    shibuya: {
      spring:  ['#渋谷春', '#渋谷桜', '#shibuya_spring', '#渋谷ファッション'],
      summer:  ['#渋谷夏', '#渋谷フェス', '#shibuya_summer', '#渋谷音楽'],
      autumn:  ['#渋谷ハロウィン', '#halloween_shibuya', '#渋谷仮装', '#スクランブル'],
      winter:  ['#渋谷クリスマス', '#渋谷イルミネーション', '#渋谷カウントダウン'],
      always:  ['#渋谷グルメ', '#shibuya', '#スクランブル交差点', '#渋谷カフェ', '#渋谷ショッピング']
    },
    ikebukuro: {
      spring:  ['#池袋桜', '#池袋春', '#ikebukuro_spring'],
      summer:  ['#池袋夏', '#サンシャイン水族館', '#池袋アニメ', '#池袋夏祭り'],
      autumn:  ['#池袋秋', '#池袋アニメフェス', '#ikebukuro_autumn'],
      winter:  ['#池袋クリスマス', '#池袋イルミ', '#池袋年末'],
      always:  ['#池袋グルメ', '#ikebukuro', '#乙女ロード', '#サンシャイン', '#池袋アニメイト', '#西武東武']
    },
    roppongi: {
      spring:  ['#六本木桜', '#新美術館', '#roppongi_art', '#六本木春'],
      summer:  ['#六本木夏', '#ヒルズ夜景', '#roppongi_night', '#六本木フェス'],
      autumn:  ['#六本木アート', '#新美術館展覧会', '#六本木ヒルズ秋'],
      winter:  ['#六本木イルミネーション', '#ミッドタウンクリスマス', '#六本木カウントダウン'],
      always:  ['#六本木グルメ', '#roppongi', '#六本木ヒルズ', '#ミッドタウン', '#六本木ナイトライフ']
    }
  };

  // -------- 内部状態 --------

  let _currentAreaId = 'ueno_park';

  let _data = {
    transit: [],
    nearbyCrowding: [],
    snsTrends: [],
    lastUpdated: null
  };

  let _listeners = [];
  let _intervalId = null;

  // -------- モックデータ生成 --------

  function _generateTransitStatus() {
    const now  = new Date();
    const hour = now.getHours();
    const isRushHour = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);
    // 六本木・歌舞伎町は深夜ラッシュも追加
    const isNightRush = (_currentAreaId === 'roppongi' || _currentAreaId === 'shinjuku') && hour >= 22;
    const baseDelayChance = (isRushHour || isNightRush) ? 0.38 : 0.18;

    const lines = TRANSIT_BY_AREA[_currentAreaId] || TRANSIT_BY_AREA.ueno_park;
    return lines.map(line => {
      const rand = Math.random();
      let status, delayMin, message, impact;

      if (rand < (1 - baseDelayChance * 1.5)) {
        status   = 'normal';   delayMin = 0;
        message  = '平常運転'; impact   = 'none';
      } else if (rand < (1 - baseDelayChance * 0.5)) {
        delayMin = Math.floor(Math.random() * 12) + 3;
        status   = 'minor_delay';
        message  = `約${delayMin}分遅延`;
        impact   = 'low';
      } else if (rand < (1 - baseDelayChance * 0.1)) {
        delayMin = Math.floor(Math.random() * 20) + 15;
        status   = 'major_delay';
        message  = `${delayMin}分以上遅延 — 混雑注意`;
        impact   = 'high';
      } else {
        delayMin = 999;
        status   = 'suspended';
        message  = '一時運転見合わせ';
        impact   = 'critical';
      }
      return { ...line, status, delayMin, message, impact };
    });
  }

  function _generateNearbyCrowding() {
    const hour = new Date().getHours();
    const facilities = NEARBY_BY_AREA[_currentAreaId] || NEARBY_BY_AREA.ueno_park;
    return facilities.map(f => {
      const base   = f.hourBases[hour];
      const jitter = (Math.random() - 0.5) * 20;
      const level  = Math.max(5, Math.min(98, Math.round(base + jitter)));
      return { id: f.id, name: f.name, icon: f.icon, level, label: getCrowdingLabel(level) };
    });
  }

  function _generateSnsTrends() {
    const month    = new Date().getMonth() + 1;
    const topics   = SNS_BY_AREA[_currentAreaId] || SNS_BY_AREA.ueno_park;
    let seasonal;
    if (month >= 3 && month <= 5)       seasonal = topics.spring;
    else if (month >= 6 && month <= 8)  seasonal = topics.summer;
    else if (month >= 9 && month <= 11) seasonal = topics.autumn;
    else                                seasonal = topics.winter;

    return [...seasonal, ...topics.always]
      .sort(() => Math.random() - 0.5)
      .slice(0, 6)
      .map(kw => ({
        keyword:  kw,
        score:    Math.floor(Math.random() * 70) + 30,
        trending: Math.random() > 0.45,
        delta:    Math.floor((Math.random() - 0.4) * 30)
      }))
      .sort((a, b) => b.score - a.score);
  }

  // -------- パブリックAPI --------

  function refresh() {
    _data.transit        = _generateTransitStatus();
    _data.nearbyCrowding = _generateNearbyCrowding();
    _data.snsTrends      = _generateSnsTrends();
    _data.lastUpdated    = new Date();
    _listeners.forEach(fn => {
      try { fn(_data); } catch (e) { console.warn('[RealtimeContext] listener error', e); }
    });
  }

  function getData() { return _data; }

  /** 表示エリアを切り替えてデータを再生成 */
  function setArea(areaId) {
    _currentAreaId = areaId || 'ueno_park';
    refresh();
  }

  function getWorstTransitDelay() {
    if (!_data.transit.length) return { delayMin: 0, name: '', status: 'normal', message: '平常運転' };
    return _data.transit.reduce((worst, line) =>
      line.delayMin > worst.delayMin ? line : worst,
      { delayMin: 0, name: '', status: 'normal', message: '平常運転' }
    );
  }

  function getWorstJrDelay() {
    const jrLines = _data.transit.filter(l => l.type === 'jr');
    if (!jrLines.length) return { delayMin: 0, name: '', status: 'normal' };
    return jrLines.reduce((worst, l) => l.delayMin > worst.delayMin ? l : worst, jrLines[0]);
  }

  function onChange(fn) { _listeners.push(fn); }

  function init(intervalMs = 3 * 60 * 1000) {
    refresh();
    if (_intervalId) clearInterval(_intervalId);
    _intervalId = setInterval(refresh, intervalMs);
    console.log('[RealtimeContext] 初期化完了（更新間隔:', intervalMs / 1000, '秒）');
  }

  function stop() {
    if (_intervalId) { clearInterval(_intervalId); _intervalId = null; }
  }

  return { init, stop, refresh, getData, setArea, getWorstTransitDelay, getWorstJrDelay, onChange };

})();

window.realtimeContext = RealtimeContext;
