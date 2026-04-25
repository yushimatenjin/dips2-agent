import type { DipsConfig } from "../config.js";
import { getTokens, isExpired } from "../auth/token-store.js";
import type { AircraftRecord } from "./types.js";

export class NotAuthenticatedError extends Error {
  constructor() {
    super("認証されていません。先に dips_login を呼び出してください。");
  }
}

export class SessionExpiredError extends Error {
  constructor() {
    super("セッションが期限切れです（DRS APIのトークンは5分で失効）。dips_login を再実行してください。");
  }
}

export class MaintenanceError extends Error {
  constructor() {
    super("DIPS-REG はメンテナンス中です（HTTP 503 / E5030001）。");
  }
}

export class DipsApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(`DIPS API ${status} ${code}: ${message}`);
  }
}

export interface UserInfo {
  sub: string;
  preferred_username: string;
}

export async function fetchUserInfo(config: DipsConfig): Promise<UserInfo> {
  const tokens = requireValidTokens();
  const res = await fetch(`${config.realmUrl}/protocol/openid-connect/userinfo`, {
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  });
  if (res.status === 401) throw new SessionExpiredError();
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    throw new DipsApiError(res.status, (body.error as string) ?? "unknown", (body.error_description as string) ?? res.statusText);
  }
  return (await res.json()) as UserInfo;
}

export async function fetchAircrafts(config: DipsConfig): Promise<AircraftRecord[]> {
  const tokens = requireValidTokens();
  const res = await fetch(`${config.baseUrl}/utm/v1/aircrafts`, {
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  });

  if (res.status === 401) throw new SessionExpiredError();
  if (res.status === 503) throw new MaintenanceError();

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const code = (body.error_code as string) ?? "unknown";
    const message = (body.error_message as string) ?? res.statusText;
    throw new DipsApiError(res.status, code, message);
  }

  return (await res.json()) as AircraftRecord[];
}

function requireValidTokens() {
  const tokens = getTokens();
  if (!tokens) throw new NotAuthenticatedError();
  if (isExpired(tokens)) throw new SessionExpiredError();
  return tokens;
}
