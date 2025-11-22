import Bull from 'bull';
import { ENV } from "./env";

export const urlQueue = new Bull('url-processing', {
  redis: {
    host: ENV.REDIS_HOST,
    port: ENV.REDIS_PORT,
  },
});

