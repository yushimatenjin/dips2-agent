import { clearTokens, getTokens } from "../auth/token-store.js";

export function logoutTool(): string {
  if (!getTokens()) return "ログイン状態ではありません。";
  clearTokens();
  return "ログアウトしました。トークンをメモリから消去しました。";
}
