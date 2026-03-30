/**
 * オトクエスト アプリ設定
 *
 * USE_REAL_API:
 *   false (デフォルト) → モックデータで動作（開発・テスト用）
 *   true               → リアルAPI（楽天等）で動作（本番用）
 *
 * 変更方法:
 *   .env.local の NEXT_PUBLIC_USE_REAL_API を書き換えてサーバー再起動
 *   または検索ページ上の「APIモード切替」スイッチで実行時に変更可能
 */

export const config = {
  /** true → リアルAPI使用、false → モックデータ使用 */
  useRealApi: process.env.NEXT_PUBLIC_USE_REAL_API === "true",

  /** 楽天アプリID（クライアントサイドから参照可能な場合のみ） */
  rakutenAppId: process.env.NEXT_PUBLIC_RAKUTEN_APP_ID ?? "",

  /** データソース表示ラベル */
  dataSourceLabel: process.env.NEXT_PUBLIC_USE_REAL_API === "true"
    ? "リアルAPI"
    : "モックデータ",
} as const;
