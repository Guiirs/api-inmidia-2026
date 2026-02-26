import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

function loadEnvFiles(): void {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const projectRoot = path.resolve(__dirname, '../..');

  // Base -> env-specific -> local -> env-specific local (highest priority)
  const envFiles = [
    '.env',
    `.env.${nodeEnv}`,
    '.env.local',
    `.env.${nodeEnv}.local`,
  ];

  for (const envFile of envFiles) {
    const envPath = path.join(projectRoot, envFile);
    if (!fs.existsSync(envPath)) continue;

    dotenv.config({
      path: envPath,
      override: true,
    });
  }
}

loadEnvFiles();

interface IStorageConfig {
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucketName?: string;
  publicUrl?: string;
}

interface IConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  port: number;
  mongoUri: string;
  nodeEnv: string;
  storage: IStorageConfig;
  corsOrigin: string;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  redisUrl: string;
}

// Validate critical environment variables
if (!process.env.JWT_SECRET) {
  process.stderr.write('[CONFIG] FATAL ERROR: JWT_SECRET is not defined in env files\n');
  process.exit(1);
}

if (!process.env.MONGODB_URI) {
  process.stderr.write('[CONFIG] FATAL ERROR: MONGODB_URI is not defined in env files\n');
  process.exit(1);
}

// Validate storage configuration in production
if (
  process.env.NODE_ENV === 'production' &&
  (!process.env.R2_ENDPOINT ||
    !process.env.R2_ACCESS_KEY_ID ||
    !process.env.R2_SECRET_ACCESS_KEY ||
    !process.env.R2_BUCKET_NAME ||
    !process.env.R2_PUBLIC_URL)
) {
  process.stderr.write('[CONFIG] WARNING: R2 storage environment variables are not fully configured. Uploads will fail in production.\n');
}

const config: IConfig = {
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  port: parseInt(process.env.PORT || '4000', 10),
  mongoUri: process.env.MONGODB_URI,
  nodeEnv: process.env.NODE_ENV || 'development',
  storage: {
    endpoint: process.env.R2_ENDPOINT,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucketName: process.env.R2_BUCKET_NAME,
    publicUrl: process.env.R2_PUBLIC_URL,
  },
  corsOrigin: process.env.CORS_ORIGIN || '*',
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
};

export default config;
