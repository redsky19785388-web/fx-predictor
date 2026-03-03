/**
 * realtime-context.js - リアルタイム・コンテキスト統合（モック実装）
 * 交通機関の運行状況、近隣施設の混雑、SNSトレンドをシミュレート
 * CrowdSense Pro v3.0
 */

const RealtimeContext = (function () {

  // -------- 定数定義 --------

  const TRANSIT_LINES = [
    { id: 'jr_yamanote',    name: 'JR山手線',           icon: '🟢', type: 'jr' },
    { id: 'jr_ueno_tokyo',  name: 'JR上野東京ライン',    icon: '🔵', type: 'jr' },
    { id: 'metro_hibiya',   name: '東京メトロ日比谷線',  icon: '🟤', type: 'metro' },
    { id: 'metro_ginza',    name: '東京メトロ銀座線',    icon: '🟡', type: 'metro' },
    { id: 'keisei',         name: '京成線',              icon: '🔴', type: 'private' }
  ];

  const NEARBY_FACILITIES = [
    { id: 'ueno_zoo',        name: '上野動物園',       icon: '🐼', capacity: 2000 },
    { id: 'national_museum', name: '東京国立博物館',   icon: '🏛️', capacity: 1500 },
    { id: 'western_art',     name: '国立西洋美術館',   icon: '🎨', capacity: 800  },
    { id: 'akihabara',       name: '秋葉原エリア',     icon: '💻', capacity: 5000 }
  ];

  const SNS_TOPICS = {
    spring:  ['#上野桜', '#花見2026', '#上野公園', '#cherry_blossom', '#お花見', '#sakura', '#上野春'],
    summer:  ['#上野動物園', '#不忍池', '#上野夏', '#蓮の花', '#夏休み上野', '#tokyo_summer'],
    autumn:  ['#上野紅葉', '#東京国立博物館', '#秋の上野', '#autumn_leaves', '#上野散歩'],
    winter:  ['#アメ横', '#年末年始', '#初詣上野', '#上野冬', '#ameyoko', '#tokyo_winter'],
    always:  ['#上野グルメ', '#東京観光', '#上野カフェ', '#ueno', '#tokyo_sightseeing', '#上野公園散歩']
  };

  // -------- 内部状態 --------

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
    const now = new Date();
    const hour = now.getHours();

    // ラッシュ時間帯は遅延確率を上げる
    const isRushHour = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);
    const baseDelayChance = isRushHour ? 0.38 : 0.18;

    return TRANSIT_LINES.map(line => {
      const rand = Math.random();
      let status, delayMin, message, impact;

      if (rand < (1 - baseDelayChance * 1.5)) {
        status   = 'normal';
        delayMin = 0;
        message  = '平常運転';
        impact   = 'none';
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
    const now  = new Date();
    const hour = now.getHours();

    // 施設ごとの時間帯別ベース混雑度
    const hourBases = {
      ueno_zoo:        [10,10,10,10,10,10,15,20,35,55,65,70,75,80,78,72,60,40,25,15,10,10,10,10],
      national_museum: [10,10,10,10,10,10,10,15,25,45,60,65,60,55,50,45,35,20,10,10,10,10,10,10],
      western_art:     [10,10,10,10,10,10,10,15,20,40,55,60,55,50,45,40,30,15,10,10,10,10,10,10],
      akihabara:       [10,10,10,10,10,10,15,25,30,40,50,55,60,65,70,75,78,80,72,60,45,30,20,12]
    };

    return NEARBY_FACILITIES.map(f => {
      const base  = (hourBases[f.id] || hourBases.akihabara)[hour];
      const jitter = (Math.random() - 0.5) * 20;
      const level  = Math.max(5, Math.min(98, Math.round(base + jitter)));
      return { ...f, level, label: getCrowdingLabel(level) };
    });
  }

  function _generateSnsTrends() {
    const month = new Date().getMonth() + 1;
    let seasonal;
    if (month >= 3 && month <= 5) seasonal = SNS_TOPICS.spring;
    else if (month >= 6 && month <= 8) seasonal = SNS_TOPICS.summer;
    else if (month >= 9 && month <= 11) seasonal = SNS_TOPICS.autumn;
    else seasonal = SNS_TOPICS.winter;

    const combined = [...seasonal, ...SNS_TOPICS.always];
    // ランダムに6件を選択し、スコアを付与
    const picked = combined
      .sort(() => Math.random() - 0.5)
      .slice(0, 6)
      .map(kw => ({
        keyword:  kw,
        score:    Math.floor(Math.random() * 70) + 30,
        trending: Math.random() > 0.45,
        delta:    Math.floor((Math.random() - 0.4) * 30) // 前回比増減
      }))
      .sort((a, b) => b.score - a.score);

    return picked;
  }

  // -------- パブリックAPI --------

  /** 全データを再生成して通知する */
  function refresh() {
    _data.transit        = _generateTransitStatus();
    _data.nearbyCrowding = _generateNearbyCrowding();
    _data.snsTrends      = _generateSnsTrends();
    _data.lastUpdated    = new Date();
    _listeners.forEach(fn => {
      try { fn(_data); } catch (e) { console.warn('[RealtimeContext] listener error', e); }
    });
  }

  /** 最新データを返す */
  function getData() { return _data; }

  /**
   * 最も深刻な交通遅延情報を返す
   * @returns {{ delayMin, name, status, message }}
   */
  function getWorstTransitDelay() {
    if (!_data.transit.length) return { delayMin: 0, name: '', status: 'normal', message: '平常運転' };
    return _data.transit.reduce((worst, line) =>
      line.delayMin > worst.delayMin ? line : worst,
      { delayMin: 0, name: '', status: 'normal', message: '平常運転' }
    );
  }

  /** JR線の最悪遅延情報を返す（オフィスワーカーへの影響が大きいため別途取得） */
  function getWorstJrDelay() {
    const jrLines = _data.transit.filter(l => l.type === 'jr');
    if (!jrLines.length) return { delayMin: 0, name: '', status: 'normal' };
    return jrLines.reduce((worst, l) => l.delayMin > worst.delayMin ? l : worst, jrLines[0]);
  }

  /** データ変化時のコールバックを登録 */
  function onChange(fn) { _listeners.push(fn); }

  /**
   * モジュールを初期化し、指定間隔で自動更新を開始する
   * @param {number} intervalMs - 更新間隔（デフォルト: 3分）
   */
  function init(intervalMs = 3 * 60 * 1000) {
    refresh(); // 初回即時実行
    if (_intervalId) clearInterval(_intervalId);
    _intervalId = setInterval(refresh, intervalMs);
    console.log('[RealtimeContext] 初期化完了（更新間隔:', intervalMs / 1000, '秒）');
  }

  function stop() {
    if (_intervalId) { clearInterval(_intervalId); _intervalId = null; }
  }

  return { init, stop, refresh, getData, getWorstTransitDelay, getWorstJrDelay, onChange };

})();

window.realtimeContext = RealtimeContext;
