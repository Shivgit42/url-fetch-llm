import Bull from 'bull';
import dotenv from 'dotenv';

dotenv.config();

export const urlQueue = new Bull('url-processing', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
});

