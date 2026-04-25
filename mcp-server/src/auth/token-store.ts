export interface TokenSet {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
  sub?: string;
  preferredUsername?: string;
}

let current: TokenSet | null = null;

export function setTokens(tokens: TokenSet): void {
  current = tokens;
}

export function getTokens(): TokenSet | null {
  return current;
}

export function clearTokens(): void {
  current = null;
}

export function isExpired(tokens: TokenSet | null = current): boolean {
  if (!tokens) return true;
  return Date.now() >= tokens.expiresAt;
}

export function remainingSeconds(tokens: TokenSet | null = current): number {
  if (!tokens) return 0;
  return Math.max(0, Math.floor((tokens.expiresAt - Date.now()) / 1000));
}
