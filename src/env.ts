function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

export const env = {
  DATABASE_URL: required("DATABASE_URL"),
  AUTH_URL: process.env.AUTH_URL ?? "https://auth.monashcoding.com",
  JWT_ISSUER: process.env.JWT_ISSUER ?? "https://auth.monashcoding.com",
  JWT_AUDIENCE: process.env.JWT_AUDIENCE ?? "mac-suite",
  PORT: Number(process.env.PORT ?? 3000),
  NODE_ENV: process.env.NODE_ENV ?? "development",
};
