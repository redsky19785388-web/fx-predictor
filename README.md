# 🤖 FX価格予測 AI - リアルタイム為替予測システム

**Gemini搭載 - 超高速・高精度なFX価格予測ブラウザアプリ**

リアルタイムの為替データを取得し、AIとテクニカル指標を組み合わせて3分後、10分後、30分後の価格を予測・表示します。

[![AI Powered](https://img.shields.io/badge/AI-Powered-00ff88?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)
[![Version](https://img.shields.io/badge/Version-2.0.0-orange?style=for-the-badge)](https://github.com/redsky19785388-web/fx-predictor)

## ✨ 主な特徴

### 🧠 AI予測（Gemini搭載）
Google Gemini APIを活用した高度な市場分析により、テクニカル指標を総合的に判断して価格を予測します。単なる数式計算ではなく、AIが市場を「思考」して予測を生成します。

### 📊 高度なテクニカル分析
- **RSI (相対力指数)**: 買われすぎ・売られすぎを判定
- **MACD**: トレンドの方向と強さを分析
- **ボリンジャーバンド**: 価格変動の範囲を可視化

### 🚀 超高速パフォーマンス
- ページ読み込み時間: **1秒以下**
- 軽量なHTMLファイル（約50KB）
- 効率的な計算アルゴリズム（O(n)）
- 非同期通信でブロッキングなし

### 📱 完全モバイル対応
- レスポンシブデザイン
- スマートフォンで片手操作可能
- タッチフレンドリーUI

### 🎨 プロフェッショナルなダークモード
- トレーダー向けのスタイリッシュなデザイン
- ネオングリーン（上昇）とネオンピンク（下降）のアクセント
- 視認性の高い等幅フォント

### 📈 ハイブリッド予測システム
- **基本予測**: 線形回帰による高速な価格予測
- **AI予測**: Geminiによる詳細な市場分析
- 両方を比較して総合的に判断可能

### 🔄 自動更新機能
- 10秒ごとに自動更新
- カウントダウン表示
- 手動更新ボタンも完備

### 📊 リアルタイムグラフ
- Chart.jsによる美しい可視化
- 過去レートと予測レートを同時表示
- インタラクティブなツールチップ

## 🌍 対応通貨ペア

- **USD/JPY** - 米ドル/日本円
- **EUR/USD** - ユーロ/米ドル
- **GBP/JPY** - 英ポンド/日本円
- **AUD/JPY** - 豪ドル/日本円
- **EUR/JPY** - ユーロ/日本円

## 🚀 使用方法

### 1. アプリを開く
ブラウザで以下のURLにアクセス：
```
https://redsky19785388-web.github.io/fx-predictor/
```

### 2. Gemini APIキーを設定（オプション）
AI予測機能を使用する場合は、以下の手順でAPIキーを設定してください：

1. [Google AI Studio](https://ai.google.dev/) にアクセス
2. 無料のAPIキーを取得（数分で完了）
3. アプリの右上の⚙️ボタンをクリック
4. APIキーを入力して「保存」

**注意**: APIキーなしでも基本予測機能は使用できます。

### 3. 通貨ペアを選択
ドロップダウンメニューから分析したい通貨ペアを選択します。

### 4. リアルタイムレートを確認
現在のレートが大きく表示され、10秒ごとに自動更新されます。

### 5. 基本予測を確認
線形回帰による3分後、10分後、30分後の価格予測が表示されます。

### 6. AI予測を実行（オプション）
「🤖 AIで詳細分析」ボタンをクリックすると、Geminiが市場を分析して詳細な予測を生成します。

### 7. トレンドグラフを分析
過去のレート推移と予測ラインをグラフで確認できます。

## 🔧 技術仕様

### 技術スタック
- **フロントエンド**: HTML5 + CSS3 + Vanilla JavaScript (ES6+)
- **グラフ描画**: Chart.js 3.9.1
- **AI分析**: Google Gemini 1.5 Flash
- **為替データ**: ExchangeRate-API (Open Access)
- **ストレージ**: LocalStorage

### 予測アルゴリズム

#### 基本予測（線形回帰）
```javascript
// 最小二乗法による線形回帰
slope = (n * ΣXY - ΣX * ΣY) / (n * ΣX² - (ΣX)²)
intercept = (ΣY - slope * ΣX) / n
prediction = intercept + slope * futureIndex
```

**計算複雑度**: O(n)

#### AI予測（Gemini）
Gemini APIに以下の情報を送信して分析：
- 現在価格
- RSI (14期間)
- MACD（12/26/9）
- ボリンジャーバンド（20期間、2σ）
- 直近の価格変動履歴

Geminiがこれらのデータを総合的に分析し、JSON形式で予測結果を返します。

### テクニカル指標

#### RSI (Relative Strength Index)
```javascript
RSI = 100 - (100 / (1 + RS))
RS = 平均利益 / 平均損失
```

**解釈**:
- RSI > 70: 買われすぎ（下落の可能性）
- RSI < 30: 売られすぎ（上昇の可能性）
- 30 ≤ RSI ≤ 70: 中立

#### MACD (Moving Average Convergence Divergence)
```javascript
MACD = EMA(12) - EMA(26)
Signal = EMA(MACD, 9)
Histogram = MACD - Signal
```

**解釈**:
- MACD > Signal: 上昇トレンド
- MACD < Signal: 下降トレンド

#### ボリンジャーバンド
```javascript
Middle = SMA(20)
Upper = Middle + (2 × σ)
Lower = Middle - (2 × σ)
```

**解釈**:
- 価格 > 上限: 買われすぎ
- 価格 < 下限: 売られすぎ
- バンド幅: ボラティリティの指標

### API仕様

#### ExchangeRate-API (Open Access)
```
エンドポイント: https://open.er-api.com/v6/latest/{base_currency}
メソッド: GET
認証: 不要
レート制限: 無制限
```

**レスポンス例**:
```json
{
  "result": "success",
  "base_code": "USD",
  "rates": {
    "JPY": 158.9938,
    "EUR": 0.9234,
    ...
  }
}
```

#### Google Gemini API
```
エンドポイント: https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent
メソッド: POST
認証: APIキー（x-goog-api-key）
レート制限: 無料枠あり
```

## 📊 UI/UXデザイン

### カラースキーム
- **背景**: ダークブルー（#0a0e27 → #1a1f3a）
- **上昇**: ネオングリーン（#00ff88）
- **下降**: ネオンピンク（#ff3366）
- **予測**: ネオンオレンジ（#ffaa00）
- **テキスト**: ライトグレー（#e0e6ff）

### レスポンシブブレークポイント
- **デスクトップ**: 600px以上
- **タブレット**: 481px - 599px
- **スマートフォン**: 480px以下

## 🔐 セキュリティ

### データプライバシー
- すべての計算はブラウザ上で実行
- 個人情報は一切送信しない
- LocalStorageは24時間分のデータのみ保持

### API通信
- HTTPS通信のみ
- APIキーはLocalStorageに保存（ブラウザのセキュリティに依存）
- CORS対応

## 📈 パフォーマンス最適化

### ファイルサイズ
- **HTML**: 約50KB（圧縮前）
- **外部依存**: Chart.js CDNのみ
- **合計読み込み**: 約100KB

### 計算効率
- **線形回帰**: O(n)
- **RSI計算**: O(n)
- **MACD計算**: O(n)
- **ボリンジャーバンド**: O(n)

### ネットワーク最適化
- 非同期通信（Async/Await）
- エラーハンドリング
- リトライ機能
- キャッシング（LocalStorage）

## 🐛 トラブルシューティング

### データが表示されない場合
1. インターネット接続を確認
2. ブラウザのコンソール（F12）でエラーを確認
3. ExchangeRate-APIが利用可能か確認
4. ページを再読み込み（Ctrl+R）

### AI予測が動作しない場合
1. Gemini APIキーが正しく設定されているか確認
2. APIキーの有効期限を確認
3. Google AI Studioでクォータを確認
4. ブラウザのコンソールでエラーメッセージを確認

### グラフが表示されない場合
1. Chart.jsがCDNから読み込まれているか確認
2. ブラウザのJavaScriptが有効になっているか確認
3. ブラウザのキャッシュをクリア

### 予測値が不正確な場合
- データが蓄積されるまで待つ（最低2データポイント必要）
- 市場が急変動している場合は予測精度が低下する可能性あり
- AI予測を併用して総合的に判断

## 📝 ライセンスと属性

### 為替レートデータ
- [ExchangeRate-API](https://www.exchangerate-api.com) - Open Access Plan

### AI分析
- [Google Gemini](https://ai.google.dev/) - Gemini 1.5 Flash

### 使用ライブラリ
- [Chart.js](https://www.chartjs.org/) - MIT License

## 💡 今後の拡張予定

- [ ] 複数の時間足対応（1分足、5分足、15分足）
- [ ] より多くのテクニカル指標（ストキャスティクス、ATR等）
- [ ] アラート機能（価格到達通知）
- [ ] 過去の予測精度の統計表示
- [ ] カスタムテーマ設定
- [ ] 多言語対応（英語、中国語等）
- [ ] PWA対応（オフライン動作）
- [ ] WebSocket対応（リアルタイムストリーミング）

## 🤝 貢献

プルリクエストを歓迎します！大きな変更の場合は、まずissueを開いて変更内容を議論してください。

## 📄 変更履歴

### v2.0.0 (2026-01-15)
- 🤖 Gemini API連携を追加
- 📊 高度なテクニカル指標（RSI, MACD, BB）を実装
- ⚙️ 設定モーダルとAPIキー管理機能を追加
- 🎨 UIを大幅に改善（ダークモード、アニメーション）
- 📈 ハイブリッド予測システムを実装
- 🔄 ローディングアニメーションを追加
- 📱 モバイル対応を強化

### v1.0.0 (2026-01-15)
- 初版リリース
- リアルタイム為替データ取得機能
- 線形回帰による価格予測
- Chart.jsグラフ表示
- モバイル対応ダークモードUI
- 自動更新機能
- LocalStorageキャッシング

## 📞 サポート

問題が発生した場合は、[Issues](https://github.com/redsky19785388-web/fx-predictor/issues)で報告してください。

## ⚠️ 免責事項

このアプリケーションは教育目的で作成されています。実際の投資判断には使用しないでください。為替取引にはリスクが伴います。投資は自己責任で行ってください。

---

**作成日**: 2026年1月15日  
**最終更新**: 2026年1月15日  
**バージョン**: 2.0.0  
**ライセンス**: MIT

Made with ❤️ and 🤖 AI
