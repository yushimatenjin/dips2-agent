import { z } from "zod";
import type { DipsConfig } from "../config.js";
import { startLogin } from "../auth/oauth.js";
import { remainingSeconds } from "../auth/token-store.js";
import { fetchUserInfo } from "../api/client.js";

export const LoginInputSchema = z.object({
  timeoutSeconds: z.number().int().min(30).max(900).optional(),
});

export type LoginInput = z.infer<typeof LoginInputSchema>;

export async function loginTool(config: DipsConfig, input: LoginInput): Promise<string> {
  const timeout = input.timeoutSeconds ?? 300;
  const { authUrl, result } = startLogin(config, timeout);

  // The browser is opened in startLogin. We immediately surface the URL so the
  // caller can also paste it manually if auto-open fails.
  const tokens = await result;
  const remaining = remainingSeconds(tokens);

  let username: string | undefined;
  try {
    const info = await fetchUserInfo(config);
    username = info.preferred_username;
  } catch {
    // Non-fatal — user info is optional
  }

  return [
    `ログイン成功 (${config.env}環境)`,
    username ? `ユーザー: ${username}` : null,
    `アクセストークン残り: 約${remaining}秒 (5分で失効するので速やかに使用してください)`,
    `認可URL (記録用): ${authUrl}`,
  ].filter(Boolean).join("\n");
}
