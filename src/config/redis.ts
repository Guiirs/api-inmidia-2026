import { createClient, RedisClientType } from 'redis';
import logger from '@shared/container/logger';
import config from '@config/config';

class RedisConfig {
  private static instance: RedisConfig;
  private client: RedisClientType;
  private readonly redisEnabledByConfig: boolean;

  private constructor() {
    this.redisEnabledByConfig = config.redisEnabled;

    if (!this.redisEnabledByConfig) {
      logger.warn('[Redis] Redis disabled by REDIS_ENABLED flag');
      this.client = {} as RedisClientType;
      return;
    }

    // In development, allow running without Redis.
    if (process.env.NODE_ENV === 'development' && !process.env.REDIS_URL) {
      logger.warn('[Redis] Redis not configured for development - using mock client');
      this.client = {} as RedisClientType;
      return;
    }

    this.client = createClient({
      url: config.redisUrl,
      socket: {
        connectTimeout: 60000,
      },
    });

    this.client.on('error', (err) => {
      logger.error('[Redis] Connection error:', err.message);
    });

    this.client.on('connect', () => {
      logger.info('[Redis] Connected successfully');
    });

    this.client.on('ready', () => {
      logger.info('[Redis] Client ready');
    });

    this.client.on('end', () => {
      logger.info('[Redis] Connection ended');
    });
  }

  public static getInstance(): RedisConfig {
    if (!RedisConfig.instance) {
      RedisConfig.instance = new RedisConfig();
    }
    return RedisConfig.instance;
  }

  public async connect(): Promise<void> {
    if (this.isMockClient()) {
      logger.info('[Redis] Mock client - skipping connection');
      return;
    }

    if (!this.client.isOpen) {
      await this.client.connect();
    }
  }

  public async disconnect(): Promise<void> {
    if (this.isMockClient()) {
      logger.info('[Redis] Mock client - skipping disconnect');
      return;
    }

    if (this.client.isOpen) {
      await this.client.disconnect();
    }
  }

  public getClient(): RedisClientType {
    if (this.isMockClient()) {
      throw new Error('Redis client not available in current environment');
    }

    return this.client;
  }

  public async ping(): Promise<string> {
    if (this.isMockClient()) {
      return 'MOCK_PONG';
    }

    return await this.client.ping();
  }

  private isMockClient(): boolean {
    return !this.redisEnabledByConfig || !this.client || typeof this.client.connect !== 'function';
  }

  public isEnabled(): boolean {
    return this.redisEnabledByConfig && !this.isMockClient();
  }
}

export default RedisConfig.getInstance();
