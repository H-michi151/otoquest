# 社労士模試アプリ（sharoshi-app）知識データベース

> **用途**: このドキュメントは他のAIやObsidianへのRAG読み込み用。  
> **最終更新**: 2026-04-06  
> **リポジトリ**: H-michi151/sharopass

---

## 1. プロジェクト概要・目的

### アプリの目的

**社会保険労務士（社労士）試験の模擬試験Webアプリ**。

本試験（国家試験）の出題形式を完全再現し、受験者が自宅でリアルな模試体験を積める環境を提供する。具体的には以下を実現する：

- 本試験と同じ試験形式（選択式・択一式）で解答できる
- 時間制限付きのタイムアタック形式
- 科目別の足切り判定を含む合否判定
- 解答後の解説表示・間違い確認
- 学習履歴の蓄積とクラウド同期

### 試験仕様（本試験準拠）

| 項目 | 選択式（午前・sentaku） | 択一式（午後・takuitsu） |
|------|----------------------|----------------------|
| 科目数 | 8科目（s1〜s8） | 7科目（t1〜t7） |
| 問題数 | 各科目1問（5空欄）合計40点 | 各科目10問 合計70点 |
| 問題プール | 各科目10問以上から1問抽選 | 各科目15問から10問抽選 |
| 試験時間 | 80分（カスタム可） | 210分（カスタム可） |
| 合格基準（総得点） | 26点以上 / 40点 | 44点以上 / 70点 |
| 合格基準（科目足切り） | 各科目3点以上 | 各科目4点以上 |

### 科目一覧

**選択式（SENTAKU_POOLS）**
- s1: 労働基準法・労働安全衛生法
- s2: 労働者災害補償保険法
- s3: 雇用保険法
- s4: 労災・雇用保険徴収法・労働関係一般常識
- s5: 社会保険一般常識
- s6: 健康保険法
- s7: 厚生年金保険法
- s8: 国民年金法

**択一式（TAKUITSU_POOLS）**
- t1: 労働基準法
- t2: 労働安全衛生法・労働者災害補償保険法
- t3: 雇用保険法
- t4: 労働関係一般常識・社会保険関係一般常識
- t5: 健康保険法
- t6: 厚生年金保険法
- t7: 国民年金法

---

## 2. 技術スタック

| レイヤー | 技術 |
|---------|------|
| フレームワーク | Next.js 14.2.0（App Router） |
| 言語 | TypeScript |
| 状態管理 | Zustand + zustand/middleware (persist) |
| スタイル | Vanilla CSS（globals.css + CSS変数） |
| DB / 認証 | Firebase v10（Firestore + Authentication）|
| ホスティング | Vercel（フロント） + さくらレンタルサーバー（PHP API） |
| バックアップDB | さくらMySQL + PHP API（Firebase代替） |

### Firebase設定状態
- `.env.local` に `NEXT_PUBLIC_FIREBASE_API_KEY` が存在する場合 → Firestore有効
- 未設定の場合 → `isFirebaseConfigured = false`、localStorageのみで完全動作

---

## 3. ディレクトリ構造

```
sharoshi-app/
├── CLAUDE.md               # 開発コンテキスト（AIへの指示書）
├── DOCS.md                 # 詳細仕様・Firestoreスキーマ
├── firestore.rules         # Firestoreセキュリティルール
├── sakura-api/             # さくらレンタルサーバー用PHP API
│   ├── config.php          # DB接続設定・JWT検証
│   ├── login.php           # ログインAPI
│   ├── register.php        # ユーザー登録API
│   ├── history_save.php    # 学習履歴保存API
│   ├── history_load.php    # 学習履歴取得API
│   └── schema.sql          # MySQLテーブル定義
└── src/
    ├── types/index.ts            # 全型定義（Question, Exam, Subject等）
    ├── lib/
    │   ├── firebase.ts           # Firebase初期化
    │   ├── firestoreHistory.ts   # Firestore学習履歴CRUD
    │   ├── firestoreProgress.ts  # Firestore科目進捗保存
    │   ├── sakuraApi.ts          # PHP APIクライアント（JWT認証）
    │   └── sampleData.ts         # 問題プールデータ（200KB超・要注意）
    ├── stores/
    │   ├── authStore.ts          # 認証ストア（デモユーザー対応）
    │   ├── examStore.ts          # 試験ストア（採点・タイマー）
    │   └── studyHistoryStore.ts  # 学習履歴（persist + Firestore同期）
    ├── components/
    │   ├── ExamTimer.tsx         # カウントダウンタイマー
    │   ├── QuestionNav.tsx       # 問題ナビゲーション（ジャンプ機能）
    │   ├── TakuitsuQuestion.tsx  # 択一式問題UI（5択ラジオ）
    │   ├── SentakuQuestion.tsx   # 選択式問題UI
    │   └── Header.tsx            # 共通ヘッダー
    └── app/
        ├── page.tsx              # ダッシュボード（トップ）
        ├── exam/[type]/page.tsx  # 試験ページ（sentaku/takuitsu）
        ├── result/[id]/page.tsx  # 結果ページ
        ├── analytics/page.tsx    # 学習分析・復習・バックアップUI
        ├── study/page.tsx        # 科目別学習モード
        ├── practice/page.tsx     # 練習モード
        └── login/page.tsx        # ログイン画面
```

---

## 4. 主要機能の仕組み

### 4-1. 選択式問題（sentaku）の仕組み

本試験方式に準拠した特殊な解答形式：

1. **20個の選択肢プール**: `correctAnswers`（正答5語）+ `additionalChoices`（ダミー15語）= 計20語
2. **5つの空欄（ア〜オ）**: 各空欄にドロップダウンで選択肢を当てはめる
3. **1回のみ使用可**: 一度選んだ選択肢は他の空欄では使用不可（`disabled`）
4. **毎回シャッフル**: 問題も選択肢も試験開始ごとにランダム順
5. **空欄の取り消し可能**: 空欄ボタン再クリックで選択解除

実装: `SentakuQuestion.tsx`

### 4-2. 択一式問題（takuitsu）の仕組み

1. **5択ラジオボタン**: 選択肢1〜5から1つ選択
2. **正答は `correctAnswer` フィールド**: 値は `"1"〜"5"`（選択肢インデックス＋1）
3. **問題ナビゲーション**: `QuestionNav.tsx` で任意の問題へジャンプ可能
4. **未回答チェック**: 提出時に未回答問題を警告

実装: `TakuitsuQuestion.tsx`

### 4-3. 採点・合否判定ロジック（examStore.ts）

```
採点フロー:
1. 全問の回答を集計
2. 科目別スコアを計算
3. 各科目の足切りラインを判定（isPassingSubject）
4. 合計スコアの合格基準を判定（isPassingTotal）
5. 全科目足切りクリア && 合計合格 → isPassing = true
6. 偏差値（deviation）を計算
```

### 4-4. 科目別学習モード（/study）

タイマーなし・フォーカス重視の学習モード：

```
状態遷移:
1. select（科目選択）→ 問題数を選択（3/5/7/10問）
2. studying（解答）→ 1問ずつ表示、全問回答後に進む
3. review（答え合わせ）→ 解説・正誤を一覧表示
```

- 択一式: 選択肢が表示され、解答を選んで「次へ」
- 選択式: 問題文と選択肢リストを表示→頭の中で考える→答え合わせで正答確認
- 択一式のみ正答率をカウント（選択式は自己採点）

### 4-5. 学習履歴の保存・復元（studyHistoryStore.ts）

**3段階の保存戦略**：

| 優先順位 | 保存先 | 条件 |
|---------|-------|------|
| 1 | localStorage（Zustand persist） | 常に自動保存（キー: `sharoshi-study-history`）|
| 2 | Firebase Firestore | `isFirebaseConfigured = true` かつログイン済み |
| 3 | さくらMySQL（PHP API） | `NEXT_PUBLIC_SAKURA_API_URL` 設定済みの場合 |

**バックアップ機能**（JSONエクスポート/インポート）：
- エクスポート: 全記録をJSONファイルとしてダウンロード
- インポート: JSONファイルから復元（重複IDはスキップ）

**復習モード**：
- `ExamRecord` に `questions[]` と `answers{}` を保存
- 過去の模試をそのままロードして解き直し可能

**集計ゲッター**：
- `getTotalStudyTime()` → 総学習時間（秒）
- `getSubjectAccuracy()` → 科目別正解率
- `getAllWrongAnswers()` → 全間違い問題リスト
- `getRecentRecords(n)` → 直近n件の記録

---

## 5. データ設計

### 5-1. Firestore コレクション設計

```
users/{uid}            → プロフィール・試験履歴IDリスト
exams/{examId}         → 試験メタ情報（タイプ・時間制限・科目）
questions/{questionId} → 問題データ（択一式・選択式）
sessions/{sessionId}   → 進行中の試験セッション
results/{resultId}     → 採点済み結果（科目別スコア・足切り・偏差値）
analysis/{userId}      → 学習分析（科目別正解率・弱点タグ等）
```

### 5-2. さくらMySQL テーブル設計

```sql
users(id, email, display_name, password_hash, created_at, last_login_at)
exam_records(
  id, user_id, exam_type, exam_date, time_taken,
  total_score, max_total_score, total_percentage, is_passing,
  subject_results JSON,  -- SubjectResult[]
  wrong_answers JSON,    -- WrongAnswerRecord[]
  questions LONGTEXT,    -- Question[] 復習用
  answers LONGTEXT       -- 回答データ 復習用
)
```

### 5-3. さくらPHP API エンドポイント

| エンドポイント | メソッド | 機能 |
|-------------|--------|------|
| `/register.php` | POST | ユーザー登録（JWT返却） |
| `/login.php` | POST | ログイン（JWT返却） |
| `/history_save.php` | POST | 試験記録保存（JWT認証必須） |
| `/history_load.php` | GET | 試験記録取得（JWT認証必須） |

- JWTトークンは `localStorage` の `sharoshi_token` に保存
- 環境変数: `NEXT_PUBLIC_SAKURA_API_URL`

---

## 6. 認証システムの現状

| 機能 | 状態 |
|-----|------|
| Googleログイン | 未実装（設計はある） |
| メール/パスワードログイン | `authStore.ts` で設計済み、UIページ（/login）は存在 |
| デモログイン | **実装済み** `authStore.loginDemo()` → uid='demo-user' |
| さくらPHP認証 | PHP側コード実装済み、フロント連携は途中 |

- Firebase Authentication は設定待ち状態
- 現状はデモログインのみ完全動作

---

## 7. 未解決の問題・既知のバグ

1. **sampleData.ts の `explanation` 未設定問題**
   - tscエラー発生（L44, 45, 91, 92, 108）
   - 一部の判例問題に `explanation` フィールドがない
   - → 各問題に解説テキストを追加する必要がある

2. **さくらレンタルサーバーはNode.js非対応**
   - Next.jsは動かせない構成
   - フロント → Vercel（無料）、APIのみ → さくらPHP
   - Firebase vs さくらMySQLの二択で設計が揺れている状態

3. **sampleData.ts のサイズ問題**
   - ファイルサイズ 200KB超。直接編集は危険
   - **修正はPythonスクリプト推奨**（scripts/ ディレクトリ）

---

## 8. 今後の開発タスク

### 短期タスク（直近）

- [ ] Firebase Authentication の実装（メール/パスワード + Google）
- [ ] ログイン画面 `/login` の完成（UIはあるが機能未結合）
- [ ] sampleData.ts の explanation 追加（tscエラー解消）
- [ ] 本番デプロイ（Vercel）

### 中期タスク（Phase 2）

- [ ] 問題解説の詳細表示（提出後に展開）
- [ ] 間違えた問題の復習モード強化
- [ ] ブックマーク機能（お気に入り問題保存）
- [ ] 学習進捗ダッシュボード
- [ ] 過去の偏差値推移グラフ
- [ ] さくらMySQL + PHP API での学習履歴保存（Firebase代替案）

### 長期タスク（Phase 3〜5）

- [ ] 全国ランキング（実際の偏差値計算）
- [ ] 年度別過去問データベース
- [ ] AI問題生成（論点別カスタム模試）
- [ ] 有料プラン（Stripe連携）
- [ ] 管理画面（問題登録・ユーザー管理）
- [ ] プッシュ通知（学習リマインダー）
- [ ] PDF印刷機能・音声読み上げ

---

## 9. 開発コマンド

```bash
npm run dev          # 開発サーバー起動 http://localhost:3000
npx tsc --noEmit     # 型チェック
npm run build        # 本番ビルド
```

---

## 10. 重要ファイルの役割まとめ

| ファイル | 役割 |
|---------|------|
| `src/lib/sampleData.ts` | **問題データの本体**（SENTAKU_POOLS / TAKUITSU_POOLS）。200KB超 |
| `src/stores/examStore.ts` | 採点・タイマー・復習ロード等の試験コアロジック |
| `src/stores/studyHistoryStore.ts` | 学習履歴の永続化・Firestore同期・エクスポート |
| `src/lib/sakuraApi.ts` | さくらPHP APIとの通信クライアント（JWT認証） |
| `sakura-api/schema.sql` | さくらMySQL のテーブル定義 |
| `CLAUDE.md` | AI（Claude/Antigravity）への開発指示書 |
| `DOCS.md` | Firestoreスキーマ・Firebase設定手順・デプロイ手順 |
