import { urlQueue } from "../../config/queue";

export function enqueueUrl(data: { url: string; type: string; id?: string }) {
  return urlQueue.add(data);
}

export function getQueueStats() {
  return Promise.all([
    urlQueue.getWaitingCount(),
    urlQueue.getActiveCount(),
    urlQueue.getCompletedCount(),
    urlQueue.getFailedCount(),
  ]);
}

export const queueEvents = urlQueue;
