import "dotenv/config";

const parsePort = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT value: "${value}"`);
  }
  return port;
};

const parseList = (value: string | undefined, fallback: string[]): string[] => {
  if (!value) return fallback;
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : fallback;
};

const nodeEnv = process.env.NODE_ENV ?? "development";
export const isProduction = nodeEnv === "production";

const parseDatabaseUrl = (value: string | undefined): string => {
  const fallback = "postgres://dataton:dataton@localhost:5432/dataton";
  const url = value ?? (isProduction ? undefined : fallback);
  if (!url) {
    throw new Error("DATABASE_URL is required in production");
  }
  return url;
};

export const env = {
  nodeEnv,
  port: parsePort(process.env.PORT, 4000),
  corsOrigins: parseList(process.env.CORS_ORIGIN, ["http://localhost:3000"]),
  databaseUrl: parseDatabaseUrl(process.env.DATABASE_URL),
} as const;
