export type DipsEnv = "production" | "development";

export interface DipsConfig {
  env: DipsEnv;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  callbackPort: number;
  baseUrl: string;
  realmUrl: string;
  issuer: string;
}

const HOSTS: Record<DipsEnv, string> = {
  production: "https://www.dips-reg.mlit.go.jp",
  development: "https://www.dips-regdev.mlit.go.jp",
};

export function loadConfig(): DipsConfig {
  const env = (process.env.DIPS_ENV ?? "development") as DipsEnv;
  if (env !== "production" && env !== "development") {
    throw new Error(`DIPS_ENV must be "production" or "development", got "${env}"`);
  }

  const clientId = required("DIPS_CLIENT_ID");
  const clientSecret = required("DIPS_CLIENT_SECRET");
  const redirectUri = process.env.DIPS_REDIRECT_URI ?? "http://localhost:8765/callback";
  const callbackPort = Number(process.env.DIPS_CALLBACK_PORT ?? 8765);

  const baseUrl = HOSTS[env];
  const realmUrl = `${baseUrl}/auth/realms/drs-utm`;
  const issuer = realmUrl;

  return { env, clientId, clientSecret, redirectUri, callbackPort, baseUrl, realmUrl, issuer };
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}
