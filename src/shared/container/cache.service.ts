/**
 * Cache Service
 * Redis caching singleton
 */
import logger from './logger';
import { RedisClientType, createClient } from 'redis';
import config from '@config/config';

let redisClient: RedisClientType | null = null;
let isRedisAvailable = false;

async function initializeRedis(): Promise<void> {
  try {
    if (!config.redisEnabled) {
      logger.info('[CacheService] Redis disabled by REDIS_ENABLED. Cache running in no-op mode.');
      isRedisAvailable = false;
      return;
    }

    redisClient = createClient({
      url: config.redisUrl,
      socket: {
        connectTimeout: 60000,
      },
    }) as RedisClientType;

    redisClient.on('error', (err: Error) => {
      logger.error('[CacheService] Redis connection error:', err.message);
      isRedisAvailable = false;
    });

    redisClient.on('connect', () => {
      logger.info('[CacheService] Connected to Redis.');
      isRedisAvailable = true;
    });

    redisClient.on('ready', () => {
      logger.info('[CacheService] Redis client ready.');
      isRedisAvailable = true;
    });

    await redisClient.connect();
  } catch (error) {
    const err = error as Error;
    logger.warn('[CacheService] Redis unavailable:', err.message);
    logger.info('[CacheService] Continuing without cache (DB fallback).');
    isRedisAvailable = false;
  }
}

async function get(key: string): Promise<unknown> {
  if (!isRedisAvailable || !redisClient) {
    return null;
  }

  try {
    const value = await redisClient.get(key);
    if (!value) return null;

    logger.debug(`[CacheService] Cache HIT: ${key}`);
    return JSON.parse(value);
  } catch (error) {
    const err = error as Error;
    logger.warn(`[CacheService] Failed to read cache key ${key}:`, err.message);
    return null;
  }
}

async function set(
  key: string,
  value: unknown,
  ttl: number = parseInt(process.env.CACHE_TTL || '300', 10)
): Promise<void> {
  if (!isRedisAvailable || !redisClient) {
    return;
  }

  try {
    const serialized = JSON.stringify(value);
    await redisClient.setEx(key, ttl, serialized);
    logger.debug(`[CacheService] Cache SET: ${key} (TTL: ${ttl}s)`);
  } catch (error) {
    const err = error as Error;
    logger.warn(`[CacheService] Failed to write cache key ${key}:`, err.message);
  }
}

async function del(keys: string | string[]): Promise<void> {
  if (!isRedisAvailable || !redisClient) {
    return;
  }

  try {
    const keysArray = Array.isArray(keys) ? keys : [keys];
    await redisClient.del(keysArray);
    logger.debug(`[CacheService] Cache DEL: ${keysArray.join(', ')}`);
  } catch (error) {
    const err = error as Error;
    logger.warn('[CacheService] Failed to delete cache keys:', err.message);
  }
}

async function invalidatePattern(pattern: string): Promise<void> {
  if (!isRedisAvailable || !redisClient) {
    return;
  }

  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
      logger.info(`[CacheService] Invalidated ${keys.length} keys for pattern: ${pattern}`);
    }
  } catch (error) {
    const err = error as Error;
    logger.warn(`[CacheService] Failed to invalidate pattern ${pattern}:`, err.message);
  }
}

function isAvailable(): boolean {
  return isRedisAvailable;
}

async function disconnect(): Promise<void> {
  if (redisClient && isRedisAvailable) {
    await redisClient.quit();
    logger.info('[CacheService] Redis connection closed.');
  }
}

export default {
  initializeRedis,
  get,
  set,
  del,
  invalidatePattern,
  isAvailable,
  disconnect,
};
