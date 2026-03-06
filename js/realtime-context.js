/**
 * realtime-context.js - リアルタイム・コンテキスト統合
 * 交通機関の運行状況（外部JSONフィード取得 + 5分キャッシュ）、
 * 近隣施設の混雑、SNSトレンドをエリア別に提供する。
 * エリア別に対応（上野・新宿・渋谷・池袋・六本木）
 * CrowdSense Pro v3.0
 */

const RealtimeContext = (function () {

  // -------- 交通遅延APIフィード設定 --------

  /**
   * rti-giken.jp の無料遅延情報JSON（APIキー不要）
   * 現在遅延中の路線一覧を返す。遅延なし路線は結果に含まれない。
   * 例: [{ "name": "JR山手線", "company": "JR東日本", ... }, ...]
   */
  const TRANSIT_FEED_URL = 'https://rti-giken.jp/fhc/api/train_tetsudo/delay.json';
  const TRANSIT_CACHE_TTL = 5 * 60 * 1000; // 5分
  const TRANSIT_CACHE_KEY = 'crowdsense_transit_cache';

  /**
   * 外部JSONフィードの路線名 → 内部ID マッピング
   * rti-giken.jp は日本語路線名でデータを返すため正規化する
   */
  const LINE_NAME_TO_ID = {
    'JR山手線':           'jr_yamanote',
    'JR上野東京ライン':   'jr_ueno_tokyo',
    '東京メトロ日比谷線': 'metro_hibiya',
    '東京メトロ銀座線':   'metro_ginza',
    '京成電鉄':           'keisei',
    '京成線':             'keisei',
    'JR中央線':           'jr_chuo',
    'JR中央・総武線':     'jr_chuo',
    '小田急電鉄':         'odakyu',
    '小田急線':           'odakyu',
    '京王電鉄':           'keio',
    '京王線':             'keio',
    '東京メトロ丸ノ内線': 'metro_marunouchi',
    'JR埼京線':           'jr_saikyo',
    '東急東横線':         'tokyu_toyoko',
    '東急田園都市線':     'tokyu_denentoshi',
    '東京メトロ半蔵門線': 'metro_hanzomon',
    '東武東上線':         'tobu_tojo',
    '西武池袋線':         'seibu_ikebukuro',
    '都営大江戸線':       'toei_oedo',
    '東京メトロ南北線':   'metro_namboku',
    '東京メトロ千代田線': 'metro_chiyoda',
    '都営三田線':         'toei_mita',
  };

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
      { id: 'animate_ikebukuro', name: 'アニメイト池袋', icon: '🎌',
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
    lastUpdated: null,
    transitSource: 'mock' // 'api' | 'cache' | 'mock'
  };

  let _listeners = [];
  let _intervalId = null;

  // in-memory transit cache（ページ内高速参照用）
  let _transitMemCache = { data: null, fetchedAt: 0 };

  // -------- 交通遅延API取得 + キャッシュ --------

  /**
   * localStorage キャッシュを読み込む
   * 有効期限（5分）内であればデータを返し、期限切れは null を返す
   */
  function _loadTransitCache() {
    try {
      const raw = localStorage.getItem(TRANSIT_CACHE_KEY);
      if (!raw) return null;
      const entry = JSON.parse(raw);
      if (Date.now() - entry.fetchedAt < TRANSIT_CACHE_TTL) return entry;
      return null; // 期限切れ
    } catch (e) {
      return null;
    }
  }

  /**
   * localStorage にキャッシュを保存する
   */
  function _saveTransitCache(parsedLines) {
    const entry = { data: parsedLines, fetchedAt: Date.now() };
    try {
      localStorage.setItem(TRANSIT_CACHE_KEY, JSON.stringify(entry));
    } catch (e) {
      console.warn('[RealtimeContext] localStorage書き込み失敗:', e);
    }
    _transitMemCache = entry;
  }

  /**
   * rti-giken.jp の遅延JSONを解析し、内部フォーマットへ変換する
   * API は「遅延中の路線のみ」返すため、含まれない路線は平常運転とみなす
   * @param {Array} apiData - API レスポンス配列
   * @returns {Set<string>} 遅延中の内部ID集合
   */
  function _parseDelayedLineIds(apiData) {
    const delayedIds = new Set();
    if (!Array.isArray(apiData)) return delayedIds;
    for (const item of apiData) {
      const name = item.name || '';
      // 部分一致で内部IDを検索（例: "JR中央線（快速）" → "jr_chuo"）
      for (const [key, id] of Object.entries(LINE_NAME_TO_ID)) {
        if (name.includes(key) || key.includes(name)) {
          delayedIds.add(id);
          break;
        }
      }
    }
    return delayedIds;
  }

  /**
   * 外部JSONフィードから遅延情報を取得し、対象エリアの路線ステータスを構築する
   * キャッシュ優先（メモリ → localStorage → API → モックフォールバック）
   */
  async function _fetchTransitStatus() {
    const areaLines = TRANSIT_BY_AREA[_currentAreaId] || TRANSIT_BY_AREA.ueno_park;

    // ① メモリキャッシュ確認（最速）
    if (_transitMemCache.data !== null &&
        Date.now() - _transitMemCache.fetchedAt < TRANSIT_CACHE_TTL) {
      console.log('[RealtimeContext] 交通情報: メモリキャッシュ使用');
      return _buildTransitFromDelayedIds(_transitMemCache.data, areaLines, 'cache');
    }

    // ② localStorageキャッシュ確認
    const lsCache = _loadTransitCache();
    if (lsCache) {
      console.log('[RealtimeContext] 交通情報: localStorageキャッシュ使用');
      _transitMemCache = lsCache; // メモリにも昇格
      return _buildTransitFromDelayedIds(lsCache.data, areaLines, 'cache');
    }

    // ③ 外部APIフェッチ（キャッシュ期限切れまたは初回）
    try {
      const controller = new AbortController();
      const timeoutId  = setTimeout(() => controller.abort(), 8000); // 8秒タイムアウト
      const res = await fetch(TRANSIT_FEED_URL, {
        signal:  controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const apiData = await res.json();

      const delayedIds = _parseDelayedLineIds(apiData);
      _saveTransitCache(delayedIds); // メモリ + localStorage に保存

      console.log(`[RealtimeContext] 交通情報: APIフェッチ成功（遅延路線数: ${delayedIds.size}）`);
      return _buildTransitFromDelayedIds(delayedIds, areaLines, 'api');

    } catch (err) {
      if (err.name === 'AbortError') {
        console.warn('[RealtimeContext] 交通APIタイムアウト → モックにフォールバック');
      } else {
        console.warn('[RealtimeContext] 交通APIエラー → モックにフォールバック:', err.message);
      }
      // ④ フォールバック: モック生成
      return _generateTransitStatusMock();
    }
  }

  /**
   * 遅延路線IDセットから、エリア路線の状態オブジェクト配列を構築する
   * @param {Set<string>|Array} delayedIds - 遅延中の内部IDの集合
   * @param {Array} areaLines - エリアの路線定義
   * @param {'api'|'cache'} source - データソース
   */
  function _buildTransitFromDelayedIds(delayedIds, areaLines, source) {
    // delayedIds は Set または Array (JSONシリアライズ後はArrayになる)
    const idSet = delayedIds instanceof Set ? delayedIds : new Set(delayedIds);
    _data.transitSource = source;

    return areaLines.map(line => {
      if (!idSet.has(line.id)) {
        return { ...line, status: 'normal', delayMin: 0, message: '平常運転', impact: 'none' };
      }
      // 遅延中の場合は実際の遅延分数をAPIは提供しないため、
      // ラッシュ時間帯に応じたヒューリスティックで分数を推定する
      const hour = new Date().getHours();
      const isRushHour = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);
      const delayMin = isRushHour
        ? Math.floor(Math.random() * 20) + 10
        : Math.floor(Math.random() * 15) + 5;

      return {
        ...line,
        status:   'major_delay',
        delayMin,
        message:  `${delayMin}分以上遅延 — 混雑注意`,
        impact:   'high'
      };
    });
  }

  // -------- モックフォールバック（API失敗時） --------

  function _generateTransitStatusMock() {
    const now  = new Date();
    const hour = now.getHours();
    const isRushHour = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);
    const isNightRush = (_currentAreaId === 'roppongi' || _currentAreaId === 'shinjuku') && hour >= 22;
    const baseDelayChance = (isRushHour || isNightRush) ? 0.38 : 0.18;

    const lines = TRANSIT_BY_AREA[_currentAreaId] || TRANSIT_BY_AREA.ueno_park;
    _data.transitSource = 'mock';
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

  // -------- 近隣施設・SNSデータ生成 --------

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

  /**
   * 全コンテキストデータを更新する（交通情報はAPIから非同期取得）
   * リスナーは取得完了後に呼ばれる
   */
  function refresh() {
    _fetchTransitStatus().then(transitLines => {
      _data.transit        = transitLines;
      _data.nearbyCrowding = _generateNearbyCrowding();
      _data.snsTrends      = _generateSnsTrends();
      _data.lastUpdated    = new Date();
      _listeners.forEach(fn => {
        try { fn(_data); } catch (e) { console.warn('[RealtimeContext] listener error', e); }
      });
    });
  }

  function getData() { return _data; }

  /** 表示エリアを切り替えてデータを再生成 */
  function setArea(areaId) {
    _currentAreaId = areaId || 'ueno_park';
    refresh();
  }

  /**
   * 最も深刻な交通遅延情報を返す（予測エンジン・ペルソナエンジン連携用）
   */
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

  /**
   * 交通遅延の混雑影響レベルを返す（予測エンジン連携用）
   * @returns {'none'|'minor'|'major'|'suspended'}
   */
  function getDelayImpactLevel() {
    const worst = getWorstTransitDelay();
    if (worst.status === 'suspended')   return 'suspended';
    if (worst.status === 'major_delay') return 'major';
    if (worst.status === 'minor_delay') return 'minor';
    return 'none';
  }

  /**
   * データソース情報を返す（UI表示用）
   * @returns {{ source: string, fetchedAt: Date|null }}
   */
  function getDataSourceInfo() {
    return {
      source:    _data.transitSource || 'mock',
      fetchedAt: _data.lastUpdated
    };
  }

  function onChange(fn) { _listeners.push(fn); }

  function init(intervalMs = 3 * 60 * 1000) {
    refresh();
    if (_intervalId) clearInterval(_intervalId);
    _intervalId = setInterval(refresh, intervalMs);
    console.log('[RealtimeContext] 初期化完了（更新間隔:', intervalMs / 1000, '秒, 交通API TTL: 5分）');
  }

  function stop() {
    if (_intervalId) { clearInterval(_intervalId); _intervalId = null; }
  }

  return {
    init, stop, refresh, getData, setArea,
    getWorstTransitDelay, getWorstJrDelay,
    getDelayImpactLevel, getDataSourceInfo,
    onChange
  };

})();

window.realtimeContext = RealtimeContext;
