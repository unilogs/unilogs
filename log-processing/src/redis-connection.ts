import { RedisOptions } from 'ioredis';
import IORedis from 'ioredis';

// change when we switch to spinning up workers with docker 
const redisConfig: RedisOptions = {
  host: process.env.REDIS_HOST || '127.0.0.1', // default host/port
  port: Number(process.env.REDIS_PORT) || 6379,
  maxRetriesPerRequest: null, // required for workers
};

export const redisConnection = new IORedis(redisConfig);
