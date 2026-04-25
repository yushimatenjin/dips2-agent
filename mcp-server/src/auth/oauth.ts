import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import open from "open";
import type { DipsConfig } from "../config.js";
import { setTokens, type TokenSet } from "./token-store.js";

const TOKEN_RESPONSE_KEYS = ["access_token", "id_token", "refresh_token", "expires_in", "scope"] as const;

interface TokenResponse {
  access_token: string;
  id_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in: number;
  token_type: string;
  scope: string;
  session_state: string;
}

export class LoginTimeoutError extends Error {
  constructor(seconds: number) {
    super(`Login timed out after ${seconds} seconds`);
  }
}

export class StateMismatchError extends Error {
  constructor() {
    super("OAuth state mismatch — possible CSRF attempt");
  }
}

export class OAuthError extends Error {
  constructor(public code: string, message: string) {
    super(`${code}: ${message}`);
  }
}

export interface LoginResult {
  authUrl: string;
  authorizeUserMessage: string;
  result: Promise<TokenSet>;
}

export function startLogin(config: DipsConfig, timeoutSeconds = 300): LoginResult {
  const state = randomBytes(16).toString("hex");
  const authUrl = buildAuthUrl(config, state);

  const result = new Promise<TokenSet>((resolve, reject) => {
    const timer = setTimeout(() => {
      server.close();
      reject(new LoginTimeoutError(timeoutSeconds));
    }, timeoutSeconds * 1000);

    const server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url ?? "/", `http://localhost:${config.callbackPort}`);
        if (url.pathname !== new URL(config.redirectUri).pathname) {
          respond(res, 404, "Not Found");
          return;
        }

        const error = url.searchParams.get("error");
        if (error) {
          const desc = url.searchParams.get("error_description") ?? "";
          respond(res, 400, `OAuth error: ${error} ${desc}`);
          clearTimeout(timer);
          server.close();
          reject(new OAuthError(error, desc));
          return;
        }

        const code = url.searchParams.get("code");
        const returnedState = url.searchParams.get("state");
        if (!code || !returnedState) {
          respond(res, 400, "Missing code or state");
          return;
        }
        if (returnedState !== state) {
          respond(res, 400, "State mismatch");
          clearTimeout(timer);
          server.close();
          reject(new StateMismatchError());
          return;
        }

        const tokens = await exchangeCode(config, code);
        await verifyIdToken(config, tokens.id_token);

        respond(res, 200, "ログインに成功しました。このウィンドウを閉じてClaudeに戻ってください。");
        clearTimeout(timer);
        server.close();

        const tokenSet: TokenSet = {
          accessToken: tokens.access_token,
          idToken: tokens.id_token,
          refreshToken: tokens.refresh_token,
          expiresAt: Date.now() + tokens.expires_in * 1000,
          scope: tokens.scope,
        };
        setTokens(tokenSet);
        resolve(tokenSet);
      } catch (err) {
        respond(res, 500, "Internal error");
        clearTimeout(timer);
        server.close();
        reject(err);
      }
    });

    server.listen(config.callbackPort, () => {
      open(authUrl).catch(() => {
        // openable failure is non-fatal — the user can paste the URL manually
      });
    });
  });

  return {
    authUrl,
    authorizeUserMessage: `ブラウザで以下を開いてDIPS-REGにログインしてください:\n${authUrl}`,
    result,
  };
}

function buildAuthUrl(config: DipsConfig, state: string): string {
  const u = new URL(`${config.realmUrl}/protocol/openid-connect/auth`);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", config.clientId);
  u.searchParams.set("redirect_uri", config.redirectUri);
  u.searchParams.set("scope", "openid offline_access");
  u.searchParams.set("state", state);
  u.searchParams.set("ui_locales", "ja");
  return u.toString();
}

async function exchangeCode(config: DipsConfig, code: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  const res = await fetch(`${config.realmUrl}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body,
  });

  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const error = (json.error as string) ?? "unknown_error";
    const desc = (json.error_description as string) ?? "";
    throw new OAuthError(error, desc);
  }

  for (const key of TOKEN_RESPONSE_KEYS) {
    if (typeof json[key] === "undefined") {
      throw new Error(`Token response missing field: ${key}`);
    }
  }
  return json as unknown as TokenResponse;
}

async function verifyIdToken(config: DipsConfig, idToken: string): Promise<void> {
  const jwks = createRemoteJWKSet(new URL(`${config.realmUrl}/protocol/openid-connect/certs`));
  await jwtVerify(idToken, jwks, {
    issuer: config.issuer,
    audience: config.clientId,
  });
}

function respond(res: ServerResponse, status: number, message: string): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(`<!doctype html><meta charset="utf-8"><title>DIPS-REG OAuth</title><body style="font-family:system-ui;padding:2rem"><h1>DIPS-REG</h1><p>${escapeHtml(message)}</p>`);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}
