import type { DipsConfig } from "../config.js";
import { fetchUserInfo } from "../api/client.js";
import { remainingSeconds } from "../auth/token-store.js";

export async function whoamiTool(config: DipsConfig): Promise<string> {
  const info = await fetchUserInfo(config);
  const remaining = remainingSeconds();
  return [
    `環境: ${config.env}`,
    `ユーザー名: ${info.preferred_username}`,
    `内部ID (sub): ${info.sub}`,
    `アクセストークン残り: 約${remaining}秒`,
  ].join("\n");
}
