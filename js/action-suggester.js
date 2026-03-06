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
  function generate({ personas, weather, transit, zoneId, hour, isWeekend, isHoliday, month,
                       airQuality, schoolVacation, sunsetTs }) {
    const suggestions = [];
    const top1 = personas[0] || null;
    const top2 = personas[1] || null;

    // 天気条件
    const temp     = weather ? weather.temp : null;
    const rain     = weather && weather.precipitationProbability > 50;
    const cold     = temp !== null && temp < 10;
    const coldSnap = temp !== null && temp < 5;
    const hot      = temp !== null && temp > 32;
    const isClear  = weather && (weather.category === 'clear');

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

    // ================================================================
    // v3.0 新ルール群
    // ================================================================

    // --- R13: 花粉高 + 晴れ + 屋内ゾーン（シナリオ1） ---
    if (airQuality && isClear) {
      const { pollenLevel, pm25Level } = AirQualityClient.getCompositeLevel(airQuality);
      const isBadAir = pollenLevel === 'high' || pollenLevel === 'very_high' ||
                       pm25Level === 'unhealthy' || pm25Level === 'hazardous';
      if (isBadAir) {
        const pollenIcons   = { none:'😊', low:'🌿', moderate:'😶', high:'😷', very_high:'🚫' };
        const pollenDisplay = `${pollenIcons[pollenLevel] || '😷'} 花粉: ${pollenLevel.replace('_',' ')} / PM2.5: ${pm25Level}`;
        suggestions.push({
          priority: 'urgent',
          icon: '🌿',
          tag: '花粉・大気質',
          title: '花粉が多いため、屋内カフェへの集客が急増中',
          message: `現在の大気質: ${pollenDisplay}。晴れているため花粉が飛散しやすく、` +
            `屋外エリアを避けて屋内施設に人が集中する傾向があります。` +
            `テイクアウトではなく店内飲食の準備を優先し、` +
            `「花粉対策の安心空間」として空気清浄機稼働・マスク置きの設置を推奨します。`,
          detail: `[花粉詳細] シラカバ: ${Math.round(airQuality.birch)}g/m³ / ` +
            `ハンノキ: ${Math.round(airQuality.alder)}g/m³ / ` +
            `PM2.5: ${Math.round(airQuality.pm25)}μg/m³`
        });
      }
    }

    // --- R14: 屋外ゾーン + 花粉高（観光客が屋外回避） ---
    if (airQuality && isClear) {
      const { pollenLevel } = AirQualityClient.getCompositeLevel(airQuality);
      if ((pollenLevel === 'high' || pollenLevel === 'very_high') &&
          (top1?.id === 'inbound_tourist' || top1?.id === 'domestic_tourist')) {
        suggestions.push({
          priority: 'recommended',
          icon: '😷',
          tag: '花粉対策',
          title: '観光客の花粉対策ニーズが高い',
          message: `花粉飛散量が多く、観光客（${top1.label}）が屋外散策を控える傾向があります。` +
            `マスク・ティッシュのサービスや「屋内で楽しめるコース提案」で来店動機を高めてください。` +
            `インバウンド向けに英語で "High pollen today – enjoy our indoor space!" の掲示も有効です。`,
          detail: `花粉レベル: ${pollenLevel}`
        });
      }
    }

    // --- R15: 学校長期休み + 平日（シナリオ2） ---
    if (schoolVacation?.isVacation && isWorkday) {
      const vac = schoolVacation.vacation;
      const { studentBoost, familyBoost } = window.schoolCalendar.getPersonaBoost(vac.id);
      suggestions.push({
        priority: 'recommended',
        icon: vac.icon,
        tag: vac.label,
        title: `${vac.label}期間中：平日でも休日並みの来客が見込まれます`,
        message: `${vac.label}のため、今日は学生・ファミリー層の来訪が通常の平日比で` +
          `最大${Math.round(studentBoost * 100 - 100)}%増加する見込みです。` +
          `平日スタッフ体制のままでは対応しきれない可能性があります。` +
          `学割メニューやお子様向けサービスを前面に出し、週末並みの準備をしてください。`,
        detail: `[学校休み詳細] ${vac.label} / 学生ブースト×${studentBoost.toFixed(1)} / ファミリーブースト×${familyBoost.toFixed(1)}`
      });
    }

    // --- R16: 日没前後30分（シナリオ3） ---
    if (sunsetTs) {
      const now        = Date.now();
      const diffMs     = now - sunsetTs;
      const inWindow   = Math.abs(diffMs) <= 30 * 60 * 1000;
      const isAfter    = diffMs > 0;
      if (inWindow) {
        const sunsetStr = new Date(sunsetTs).toLocaleTimeString('ja-JP',
          { hour: '2-digit', minute: '2-digit' });
        if (isAfter) {
          suggestions.push({
            priority: 'recommended',
            icon: '🌇',
            tag: '日没シフト',
            title: `日没（${sunsetStr}）後：ディナー需要へシフト中`,
            message: `日没を境に屋外エリアから人が離れ、カフェ・飲食系への流入が急増しています。` +
              `ランチメニューからディナーメニューへの切り替え・照明演出の変更・` +
              `テーブルセッティングの見直しを今すぐ実施してください。` +
              `「日没後の特別ドリンク」のアナウンスで客単価アップを狙えます。`,
            detail: `日没時刻: ${sunsetStr}`
          });
        } else {
          const minLeft = Math.round(Math.abs(diffMs) / 60000);
          suggestions.push({
            priority: 'info',
            icon: '🌆',
            tag: '夕方対策',
            title: `日没まで${minLeft}分：夕方シフトの準備を`,
            message: `あと${minLeft}分で日没（${sunsetStr}）を迎えます。` +
              `屋外エリアから屋内への人流シフトが始まります。` +
              `ディナーセッティング・照明切り替え・夕食メニューの準備を今から進めてください。`,
            detail: `日没時刻: ${sunsetStr}`
          });
        }
      }
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
