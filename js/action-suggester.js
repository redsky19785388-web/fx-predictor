/**
 * action-suggester.js - ニーズ（嗜好）の自動提案エンジン
 * 推計ペルソナ × リアルタイム環境 → 店舗管理者への具体的なアクション提案
 * CrowdSense Pro v3.0
 */

const ActionSuggester = (function () {

  /**
   * アクション提案を生成する
   * @param {Object} params
   * @param {Array}  params.personas    - personaEngine.estimate() の結果（割合順）
   * @param {Object|null} params.weather   - { temp, precipitationProbability, weatherCode }
   * @param {Array}  params.transit     - realtimeContext.getData().transit
   * @param {string} params.zoneId     - 現在のゾーンID
   * @param {number} params.hour       - 現在の時刻（0-23）
   * @param {boolean} params.isWeekend - 週末フラグ
   * @param {boolean} params.isHoliday - 祝日フラグ
   * @param {number} params.month      - 月（1-12）
   * @returns {Array<{priority, icon, title, message, tag}>}
   */
  function generate({ personas, weather, transit, zoneId, hour, isWeekend, isHoliday, month }) {
    const suggestions = [];
    const top1 = personas[0] || null;
    const top2 = personas[1] || null;

    // 天気条件
    const temp   = weather ? weather.temp : null;
    const rain   = weather && weather.precipitationProbability > 50;
    const cold   = temp !== null && temp < 10;
    const coldSnap = temp !== null && temp < 5;
    const hot    = temp !== null && temp > 32;

    // 交通遅延
    const worstDelay   = transit && transit.length
      ? transit.reduce((w, l) => l.delayMin > w.delayMin ? l : w, transit[0])
      : { delayMin: 0, name: '', status: 'normal' };
    const jrLines      = (transit || []).filter(l => l.type === 'jr');
    const worstJr      = jrLines.length
      ? jrLines.reduce((w, l) => l.delayMin > w.delayMin ? l : w, jrLines[0])
      : { delayMin: 0, name: '', status: 'normal' };

    const isSakura = month === 3 || month === 4;
    const isWorkday = !isWeekend && !isHoliday;

    // ================================================================
    // ルール群（優先度: urgent > recommended > info）
    // ================================================================

    // --- R1: JR遅延 + オフィスワーカー ---
    if (worstJr.delayMin >= 10 && top1 && top1.id === 'office_worker') {
      suggestions.push({
        priority: 'urgent',
        icon: '🚨',
        tag: '交通遅延',
        title: `${worstJr.name}遅延：オフィスワーカーの足止め発生`,
        message: `現在、${worstJr.name}で${worstJr.delayMin}分遅延が発生しています。` +
          `「近隣オフィスワーカー」の推計割合が${top1.percentage}%と高く、足止め需要が見込まれます。` +
          `電源コンセントとWi-Fiの案内を強化し、長居できる環境をアピールすることを推奨します。`
      });
    }

    // --- R2: 大幅遅延（全路線）---
    if (worstDelay.delayMin >= 20) {
      suggestions.push({
        priority: 'urgent',
        icon: '⏳',
        tag: '待機客対応',
        title: `運行障害：待機客への対応強化を`,
        message: `${worstDelay.name}で${worstDelay.delayMin}分以上の大幅遅延が発生しています。` +
          `駅周辺から待機客がエリアへ流入する可能性があります。` +
          `テイクアウトとイートイン双方の対応を整え、スタッフのスタンバイ体制を確保してください。`
      });
    }

    // --- R3: 急激な寒波 ---
    if (coldSnap) {
      suggestions.push({
        priority: 'urgent',
        icon: '🧥',
        tag: '急激な寒波',
        title: `気温${temp}°C：急激な寒波への即時対応`,
        message: `気温が${temp}°Cと非常に低くなっています。店内の暖かさを入口で積極的にアピールし、` +
          `温かい飲食物を入口付近に目立つよう配置してください。` +
          `シニア層への配慮（段差・滑り注意の張り紙）も合わせてご確認ください。`
      });
    }

    // --- R4: 寒い + 観光客 ---
    if (cold && !coldSnap && (
      (top1 && (top1.id === 'inbound_tourist' || top1.id === 'domestic_tourist')) ||
      (top2 && (top2.id === 'inbound_tourist' || top2.id === 'domestic_tourist'))
    )) {
      const touristPersona = (top1 && (top1.id === 'inbound_tourist' || top1.id === 'domestic_tourist'))
        ? top1 : top2;
      suggestions.push({
        priority: 'recommended',
        icon: '🍵',
        tag: '寒冷対応',
        title: `気温${temp}°C：観光客向け温かい商品を前面に`,
        message: `気温が${temp}°Cまで低下しています。「${touristPersona.label}」の来訪が推計${touristPersona.percentage}%と見込まれます。` +
          `温かいスープ・ホットドリンクのタイムセールを実施し、` +
          `外国語（英語・中国語）でのPOPを入口付近に設置することを推奨します。`
      });
    }

    // --- R5: 猛暑 ---
    if (hot) {
      suggestions.push({
        priority: 'recommended',
        icon: '🧊',
        tag: '猛暑対応',
        title: `気温${temp}°C：冷却スポットとしてアピール`,
        message: `気温が${temp}°Cを超えています。冷たい飲み物・アイス・かき氷などを目立つ場所に配置し、` +
          `クールダウンスポットとして積極的にアピールしてください。` +
          `訪日外国人には英語でのアナウンスも有効です（"Cool drinks available inside!"）。`
      });
    }

    // --- R6: 雨天 + 観光客 ---
    if (rain && (
      (top1 && (top1.id === 'inbound_tourist' || top1.id === 'domestic_tourist')) ||
      (top2 && (top2.id === 'inbound_tourist' || top2.id === 'domestic_tourist'))
    )) {
      suggestions.push({
        priority: 'recommended',
        icon: '☔',
        tag: '雨天対応',
        title: '降雨：屋外観光客の屋内誘導を強化',
        message: `降雨により屋外エリアから観光客が移動してくる可能性があります。` +
          `「雨の日特典（ドリンク割引など）」を設置し、座席確保とカウンター対応を強化してください。` +
          `無料Wi-Fi・傘立ての案内も合わせて掲示することを推奨します。`
      });
    }

    // --- R7: 平日ランチ + オフィスワーカー ---
    if (isWorkday && hour >= 11 && hour < 14 && top1 && top1.id === 'office_worker') {
      suggestions.push({
        priority: 'recommended',
        icon: '🍱',
        tag: 'ランチ対応',
        title: 'ランチピーク：スピード提供でオフィス客を取り込む',
        message: `近隣オフィスワーカーの推計割合が${top1.percentage}%と高い時間帯です。` +
          `「10分以内提供保証」やモバイルオーダーの案内をレジ付近に掲示し、` +
          `限られた休憩時間を有効活用できる環境をアピールしてください。`
      });
    }

    // --- R8: 医療・大学関係者 ---
    if (top1 && top1.id === 'medical_academic' ||
       (top2 && top2.id === 'medical_academic' && (top2.percentage || 0) > 15)) {
      const p = (top1 && top1.id === 'medical_academic') ? top1 : top2;
      suggestions.push({
        priority: 'info',
        icon: '🎓',
        tag: '大学・医療関係者',
        title: '医療・大学関係者向け：静かな作業環境をアピール',
        message: `東大・東京医科大エリアからの医療・大学関係者の来訪が推計${p.percentage}%と見込まれます。` +
          `電源コンセント・静かな席の案内を充実させ、プレミアムコーヒー・軽食のメニューを前面に出してください。` +
          `長時間滞在を歓迎するメッセージも効果的です。`
      });
    }

    // --- R9: インバウンド観光客が多い ---
    if (top1 && top1.id === 'inbound_tourist' && top1.percentage > 22) {
      suggestions.push({
        priority: 'info',
        icon: '🌍',
        tag: '多言語対応',
        title: `訪日外国人が推計${top1.percentage}%：多言語対応を確認`,
        message: `インバウンド観光客の割合が高い時間帯です。英語・中国語（繁体/簡体）・韓国語のメニューと案内板を確認し、` +
          `キャッシュレス決済（Alipay、WeChat Pay、Visa Tap to Pay）の稼働状況を確認してください。`
      });
    }

    // --- R10: 週末ファミリー午前〜午後 ---
    if ((isWeekend || isHoliday) && top1 && top1.id === 'local_family' &&
        hour >= 10 && hour < 16) {
      suggestions.push({
        priority: 'info',
        icon: '👨‍👩‍👧',
        tag: 'ファミリー',
        title: '週末ファミリー層の来訪が多い時間帯',
        message: `地域住民・ファミリー層の来訪が推計${top1.percentage}%と見込まれます。` +
          `お子様メニューや親子向けサービスの案内を入口付近に掲示し、` +
          `ベビーカー対応スペース・授乳室の案内も行ってください。`
      });
    }

    // --- R11: 平日午前のシニア層 ---
    if (isWorkday && hour >= 9 && hour < 12 && (
      (top1 && top1.id === 'senior') ||
      (top2 && top2.id === 'senior' && (top2.percentage || 0) > 12)
    )) {
      const p = (top1 && top1.id === 'senior') ? top1 : top2;
      suggestions.push({
        priority: 'info',
        icon: '👴',
        tag: 'シニア層',
        title: '平日午前：シニア・退職者層の利用が多い時間帯',
        message: `シニア・退職者層の来訪が推計${p.percentage}%と見込まれます。` +
          `モーニングセット・ゆったり座れる席配置・大きな文字のメニューを用意し、` +
          `落ち着いた雰囲気をアピールしてください。`
      });
    }

    // --- R12: 桜シーズン + 観光客 ---
    if (isSakura && (
      (top1 && (top1.id === 'inbound_tourist' || top1.id === 'domestic_tourist')) ||
      (top2 && (top2.id === 'inbound_tourist' || top2.id === 'domestic_tourist'))
    )) {
      suggestions.push({
        priority: 'info',
        icon: '🌸',
        tag: '桜シーズン',
        title: '桜シーズン：観光客向けの特別提案を',
        message: `桜シーズンで観光客が増加しています。桜・花見をテーマにした限定メニューや` +
          `フォトスポットの案内をSNSでも発信し、来店動機を高めてください。` +
          `「#上野桜」タグでの投稿を促すPOPも有効です。`
      });
    }

    // --- フォールバック: 提案なし ---
    if (suggestions.length === 0) {
      suggestions.push({
        priority: 'info',
        icon: '📋',
        tag: '通常営業',
        title: '現在、特筆すべきアクションはありません',
        message: `天気・交通・来客属性ともに安定した状況です。` +
          `通常オペレーションを維持してください。データは3分ごとに自動更新されます。`
      });
    }

    // 優先度でソートして最大4件返す
    const ORDER = { urgent: 0, recommended: 1, info: 2 };
    return suggestions
      .sort((a, b) => ORDER[a.priority] - ORDER[b.priority])
      .slice(0, 4);
  }

  return { generate };

})();

window.actionSuggester = ActionSuggester;
