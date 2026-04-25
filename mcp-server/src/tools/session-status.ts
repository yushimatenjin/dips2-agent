import { getTokens, remainingSeconds } from "../auth/token-store.js";

export function sessionStatusTool(): string {
  const tokens = getTokens();
  if (!tokens) return "未ログイン。dips_login を呼び出してください。";
  const remaining = remainingSeconds(tokens);
  if (remaining <= 0) return "セッション期限切れ。dips_login を再実行してください。";
  return `ログイン中。アクセストークン残り: 約${remaining}秒`;
}
