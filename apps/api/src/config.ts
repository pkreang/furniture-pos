export interface AppConfig {
  databaseUrl: string;
  port: number;
  nodeEnv: string;
  isProduction: boolean;
}

/**
 * Reads and validates the runtime environment. Throws immediately on missing
 * required configuration so the API fails fast rather than misbehaving later.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required but not set");
  }
  const nodeEnv = env.NODE_ENV ?? "development";
  return {
    databaseUrl,
    port: Number(env.PORT ?? env.API_PORT ?? 3000),
    nodeEnv,
    isProduction: nodeEnv === "production",
  };
}
