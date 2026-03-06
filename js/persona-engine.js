/**
 * persona-engine.js - 動的ペルソナ推計エンジン
 * 場所・時間帯・天気・交通状況から「現在どのような属性の集団が多いか」を確率的に推計する。
 * 個人をトラッキングするのではなく、集団レベルの属性割合を環境要因から推計する。
 * CrowdSense Pro v3.0
 */

const PersonaEngine = (function () {

  // -------- ペルソナ定義 --------

  const PERSONAS = [
    {
      id:    'office_worker',
      label: '近隣オフィスワーカー（IT・クリエイティブ系）',
      short: 'オフィスワーカー',
      icon:  '💼',
      color: '#6366f1',
      desc:  '台東区・秋葉原・御徒町周辺のオフィス勤務者。ランチや退勤後の利用が多い。'
    },
    {
      id:    'medical_academic',
      label: '医療・大学関係者（東大・病院エリア）',
      short: '医療・大学関係者',
      icon:  '🎓',
      color: '#3b82f6',
      desc:  '東京大学・東京医科大学・東大病院などからの流入。専門性が高く静かな環境を好む。'
    },
    {
      id:    'inbound_tourist',
      label: 'インバウンド観光客',
      short: 'インバウンド観光客',
      icon:  '✈️',
      color: '#f59e0b',
      desc:  '上野・浅草を回遊するアジア系・欧米系の訪日外国人。多言語対応・キャッシュレス需要が高い。'
    },
    {
      id:    'domestic_tourist',
      label: '国内観光客・日帰りレジャー',
      short: '国内観光客',
      icon:  '🗺️',
      color: '#ec4899',
      desc:  '首都圏・地方からの観光・文化施設目的の訪問者。週末・祝日に増加する。'
    },
    {
      id:    'local_family',
      label: '地域住民・ファミリー',
      short: 'ファミリー',
      icon:  '👨‍👩‍👧',
      color: '#10b981',
      desc:  '台東区・文京区在住のファミリー層。公園・動物園・休日散策が目的。'
    },
    {
      id:    'senior',
      label: 'シニア・退職者',
      short: 'シニア',
      icon:  '👴',
      color: '#06b6d4',
      desc:  '平日午前中を中心に公園・文化施設を利用する退職者層。ゆったりとした環境を好む。'
    },
    {
      id:    'student',
      label: '学生・若者グループ',
      short: '学生',
      icon:  '📚',
      color: '#8b5cf6',
      desc:  '東大・芸大・専門学校などの学生。カフェでの滞在・飲食目的が多い。'
    }
  ];

  // -------- 推計ロジック --------

  /**
   * 環境要因からペルソナ割合を推計する
   * @param {Object} params
   * @param {string} params.zoneId - ゾーンID
   * @param {number} params.hour - 現在の時刻（0-23）
   * @param {boolean} params.isWeekend - 週末フラグ
   * @param {boolean} params.isHoliday - 祝日フラグ
   * @param {Object|null} params.weather - { temp, precipitationProbability }
   * @param {number} params.transitDelayMin - 最大交通遅延（分）
   * @param {number} params.month - 月（1-12）
   * @param {Object|null} params.schoolVacation - SchoolCalendar.check() の結果
   * @returns {Array<{id, label, short, icon, color, desc, percentage}>} - 割合順ソート済み
   */
  function estimate({ zoneId, hour, isWeekend, isHoliday, weather, transitDelayMin = 0, month,
                       schoolVacation = null }) {
    const isWorkday = !isWeekend && !isHoliday;
    const raining   = weather && weather.precipitationProbability > 50;
    const cold      = weather && weather.temp < 10;
    const hot       = weather && weather.temp > 32;
    const isSakura  = month === 3 || month === 4;

    // ---- ベース重みを初期化 ----
    const w = {
      office_worker:    0,
      medical_academic: 0,
      inbound_tourist:  0,
      domestic_tourist: 0,
      local_family:     0,
      senior:           0,
      student:          0
    };

    // ---- 時間帯 × 平日/休日 ルール ----
    if (isWorkday) {

      if (hour >= 7 && hour < 10) {
        // 平日朝ラッシュ
        w.office_worker    += 45;
        w.medical_academic += 28;
        w.student          += 18;
        w.local_family     +=  5;
        w.senior           +=  2;
        w.domestic_tourist +=  1;
        w.inbound_tourist  +=  1;

      } else if (hour >= 10 && hour < 12) {
        // 平日午前
        w.office_worker    += 18;
        w.medical_academic += 18;
        w.domestic_tourist += 20;
        w.inbound_tourist  += 18;
        w.senior           += 12;
        w.local_family     +=  8;
        w.student          +=  6;

      } else if (hour >= 12 && hour < 14) {
        // 平日ランチ
        w.office_worker    += 42;
        w.medical_academic += 22;
        w.student          += 15;
        w.domestic_tourist +=  8;
        w.inbound_tourist  +=  8;
        w.local_family     +=  3;
        w.senior           +=  2;

      } else if (hour >= 14 && hour < 17) {
        // 平日午後
        w.domestic_tourist += 26;
        w.inbound_tourist  += 24;
        w.senior           += 16;
        w.local_family     += 14;
        w.student          += 10;
        w.office_worker    +=  6;
        w.medical_academic +=  4;

      } else if (hour >= 17 && hour < 20) {
        // 平日夕方・帰宅ラッシュ
        w.office_worker    += 42;
        w.student          += 22;
        w.medical_academic += 15;
        w.local_family     +=  8;
        w.domestic_tourist +=  8;
        w.senior           +=  3;
        w.inbound_tourist  +=  2;

      } else {
        // 平日深夜・早朝
        w.office_worker    += 22;
        w.student          += 22;
        w.local_family     += 18;
        w.inbound_tourist  += 16;
        w.domestic_tourist += 12;
        w.medical_academic +=  6;
        w.senior           +=  4;
      }

    } else {
      // 週末・祝日
      if (hour >= 10 && hour < 17) {
        w.domestic_tourist += 30;
        w.inbound_tourist  += 25;
        w.local_family     += 22;
        w.senior           += 10;
        w.student          +=  8;
        w.office_worker    +=  3;
        w.medical_academic +=  2;

      } else if (hour >= 17 && hour < 21) {
        w.domestic_tourist += 24;
        w.inbound_tourist  += 20;
        w.local_family     += 18;
        w.student          += 22;
        w.senior           +=  8;
        w.office_worker    +=  5;
        w.medical_academic +=  3;

      } else {
        w.domestic_tourist += 25;
        w.inbound_tourist  += 24;
        w.student          += 22;
        w.local_family     += 18;
        w.senior           +=  6;
        w.office_worker    +=  3;
        w.medical_academic +=  2;
      }
    }

    // ---- ゾーン補正 ----
    switch (zoneId) {
      case 'zone_ameyoko':
        w.inbound_tourist  *= 2.2;
        w.domestic_tourist *= 1.6;
        w.local_family     *= 1.2;
        break;
      case 'zone_national_museum':
        w.inbound_tourist  *= 1.8;
        w.domestic_tourist *= 1.4;
        w.senior           *= 1.6;
        w.medical_academic *= 1.5;
        w.student          *= 1.3;
        break;
      case 'zone_art_museum':
        w.inbound_tourist  *= 1.6;
        w.domestic_tourist *= 1.3;
        w.senior           *= 1.4;
        w.medical_academic *= 1.4;
        w.student          *= 1.2;
        break;
      case 'zone_zoo_cafe':
        w.local_family     *= 2.0;
        w.student          *= 1.4;
        w.office_worker    *= 1.3; // 近隣ランチ需要
        w.senior           *= 1.2;
        break;
      case 'zone_sakura_path':
        if (isSakura) {
          w.inbound_tourist  *= 2.5;
          w.domestic_tourist *= 2.2;
        }
        w.senior    *= 1.3;
        w.local_family *= 1.2;
        break;
      case 'zone_toshogu':
        w.inbound_tourist  *= 1.6;
        w.domestic_tourist *= 1.4;
        w.senior           *= 1.5;
        break;
      case 'zone_shinobazu_boat':
        w.local_family     *= 1.8;
        w.domestic_tourist *= 1.3;
        w.senior           *= 1.4;
        break;
      default:
        break;
    }

    // ---- 天気補正 ----
    if (raining) {
      w.office_worker    *= 1.35; // 雨宿り需要（近隣ワーカー）
      w.medical_academic *= 1.15;
      w.inbound_tourist  *= 0.55;
      w.domestic_tourist *= 0.65;
      w.local_family     *= 0.55;
      w.senior           *= 0.65;
      w.student          *= 0.75;
    }

    // ---- 交通遅延・運転見合わせ補正 ----
    // 遅延・見合わせで足止めされた乗客が屋内施設に滞留するため
    // オフィスワーカーと学生の滞留率を引き上げ、
    // 遠方からの観光客は移動を諦める傾向として観光客比率を下げる
    if (transitDelayMin >= 100) {
      // 運転見合わせ（delayMin === 999 を含む）: 大規模足止め
      w.office_worker    *= 2.2;  // 帰宅困難ワーカーが大量滞留
      w.student          *= 1.8;  // 通学困難学生の滞留
      w.medical_academic *= 1.5;
      w.local_family     *= 1.3;  // 近隣住民も外出自粛から帰宅困難へ
      w.domestic_tourist *= 0.6;  // 観光客は観光を中断して移動手段を探す
      w.inbound_tourist  *= 0.5;  // インバウンドは特に移動に困り観光中断
    } else if (transitDelayMin >= 10) {
      // 大幅遅延（10分以上）: 中規模足止め
      w.office_worker    *= 1.5;
      w.medical_academic *= 1.3;
      w.student          *= 1.25;
      w.domestic_tourist *= 0.85;
    } else if (transitDelayMin >= 5) {
      // 軽微な遅延（5〜9分）: 小規模影響
      w.office_worker    *= 1.2;
      w.student          *= 1.1;
    }

    // ---- 学校長期休み補正（シナリオ2）----
    // 平日でも学校が休みの場合、学生・ファミリーが昼間に自由行動できる
    if (schoolVacation?.isVacation && isWorkday) {
      const { studentBoost, familyBoost } =
        window.schoolCalendar?.getPersonaBoost(schoolVacation.vacation.id) ||
        { studentBoost: 2.0, familyBoost: 1.8 };
      w.student      *= studentBoost;
      w.local_family *= familyBoost;
      // 平日に学生・家族が増える分、オフィスワーカーの相対的比率は下がる
      w.office_worker    *= 0.75;
      w.medical_academic *= 0.85;
    }

    // ---- 桜シーズン全体補正 ----
    if (isSakura) {
      w.inbound_tourist  *= 1.4;
      w.domestic_tourist *= 1.3;
    }

    // ---- 正規化（合計100%に） ----
    const total = Object.values(w).reduce((s, v) => s + v, 0);
    if (total === 0) return PERSONAS.map(p => ({ ...p, percentage: Math.round(100 / PERSONAS.length) }));

    const normalized = {};
    let sumSoFar = 0;
    const keys = Object.keys(w);
    keys.forEach((k, i) => {
      if (i < keys.length - 1) {
        const pct = Math.round((w[k] / total) * 100);
        normalized[k] = pct;
        sumSoFar += pct;
      } else {
        normalized[k] = 100 - sumSoFar; // 丸め誤差を最後のキーに吸収
      }
    });

    return PERSONAS
      .map(p => ({ ...p, percentage: Math.max(0, normalized[p.id] || 0) }))
      .sort((a, b) => b.percentage - a.percentage);
  }

  /** 上位N件のペルソナを返す */
  function getTop(estimates, n = 3) {
    return estimates.slice(0, n);
  }

  return { estimate, getTop, PERSONAS };

})();

window.personaEngine = PersonaEngine;
