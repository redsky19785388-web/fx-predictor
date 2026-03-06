/**
 * school-calendar.js - 日本の学校長期休み判定カレンダー
 * 外部APIに依存しない完全ハードコード実装
 * 対象: 小学校・中学校・高校の一般的な休業期間（公立標準）
 * CrowdSense Pro v3.0
 */

const SchoolCalendar = (function () {

  /**
   * 年度ごとの長期休み定義
   * - 年をまたぐ冬休みは month 12 & 1 で分割管理
   * - 各年の桜シーズン（入学式前後）は spring_break に統合
   */
  const VACATION_DEFS = [
    // ── 春休み（3月下旬〜4月上旬） ──
    // 終業式: 概ね3/22〜3/26 / 始業式: 概ね4/8〜4/10
    { id: 'spring_break',  label: '春休み',  icon: '🌸',
      start: { month: 3, day: 22 }, end: { month: 4, day: 9 } },

    // ── 夏休み（7月下旬〜8月末） ──
    // 終業式: 概ね7/20〜7/22 / 始業式: 概ね9/1
    { id: 'summer_break',  label: '夏休み',  icon: '☀️',
      start: { month: 7, day: 20 }, end: { month: 8, day: 31 } },

    // ── 冬休み（12月後半〜1月上旬） ──
    // 終業式: 概ね12/24〜12/25 / 始業式: 概ね1/7〜1/8
    { id: 'winter_break',  label: '冬休み',  icon: '⛄',
      start: { month: 12, day: 24 }, end: { month: 1, day: 7 } },

    // ── ゴールデンウィーク（授業あるが連休として実質休み扱い） ──
    { id: 'golden_week',   label: 'GW',      icon: '🎏',
      start: { month: 4, day: 29 }, end: { month: 5, day: 6 } },
  ];

  /**
   * 追加の単発学校休業（文化祭準備日、創立記念日等）は
   * 固定化できないため、日曜+月曜を「週明けの振替休日」として
   * 動的に評価する（isHolidayClient で対応済み）
   */

  /**
   * 日付が学校の長期休み期間内かどうかを返す
   * @param {Date|string|number} date
   * @returns {{ isVacation: boolean, vacation: Object|null }}
   */
  function check(date) {
    const d     = new Date(date);
    const month = d.getMonth() + 1;
    const day   = d.getDate();

    for (const vac of VACATION_DEFS) {
      const { start, end } = vac;

      // 年またぎ（冬休み: 12/24 〜 1/7）
      if (start.month > end.month) {
        if (
          (month === start.month && day >= start.day) ||
          (month === end.month   && day <= end.day)
        ) {
          return { isVacation: true, vacation: vac };
        }
      } else {
        // 同年内
        const afterStart = month > start.month || (month === start.month && day >= start.day);
        const beforeEnd  = month < end.month   || (month === end.month   && day <= end.day);
        if (afterStart && beforeEnd) {
          return { isVacation: true, vacation: vac };
        }
      }
    }
    return { isVacation: false, vacation: null };
  }

  /**
   * 学校長期休みの混雑ブーストを返す（予測エンジン向け）
   *
   * シナリオ2: 平日 + 学校長期休み →
   *   学生・ファミリー向けゾーン（動物園・公園・市場・余暇）を
   *   「休日に近い水準」まで引き上げる
   *
   * @param {Object} zone    - ゾーン定義 { type, id }
   * @param {boolean} isWeekday - true = 平日
   * @param {string} vacationId - 'spring_break'|'summer_break'等
   * @returns {number} modifier (1.0 = 変化なし)
   */
  function getVacationModifier(zone, isWeekday, vacationId) {
    if (!isWeekday) return 1.0; // 元々の週末モデルで対応済み

    // 平日 + 学校休み: ゾーンタイプ別ブースト
    const boostByType = {
      park:    1.45, // 公園・桜並木に家族・学生が集まる
      leisure: 1.50, // ボート・アクティビティ急増
      market:  1.35, // アメ横など人出増
      cafe:    1.30, // カフェに学生・ファミリー滞在増
      shrine:  1.20, // 観光需要増
      museum:  1.25, // 体験学習・自由研究目的
    };

    // 夏休みは他の季節より効果大（最長休み）
    const seasonMultiplier = vacationId === 'summer_break' ? 1.15 : 1.0;

    const base = boostByType[zone.type] || 1.10;
    return base * seasonMultiplier;
  }

  /**
   * 学校長期休みのペルソナシフト（学生・ファミリー増加率）
   * @param {string} vacationId
   * @returns {{ studentBoost: number, familyBoost: number }}
   */
  function getPersonaBoost(vacationId) {
    switch (vacationId) {
      case 'summer_break':  return { studentBoost: 3.0, familyBoost: 2.5 };
      case 'spring_break':  return { studentBoost: 2.5, familyBoost: 2.2 };
      case 'winter_break':  return { studentBoost: 2.2, familyBoost: 2.0 };
      case 'golden_week':   return { studentBoost: 2.0, familyBoost: 2.5 };
      default:              return { studentBoost: 1.0, familyBoost: 1.0 };
    }
  }

  return { check, getVacationModifier, getPersonaBoost };

})();

window.schoolCalendar = SchoolCalendar;
