import { fetchStatusAggregates } from "../repositories/urlRepository";
import { getQueueStats } from "../repositories/queueRepository";

export async function getSystemStatus() {
  const stats = await fetchStatusAggregates();
  const [waiting, active, completed, failed] = await getQueueStats();

  return {
    database: {
      pending: stats.pending || 0,
      completed: stats.completed || 0,
      failed: stats.failed || 0,
      total: Object.values(stats).reduce((acc, value) => acc + value, 0),
    },
    queue: {
      waiting,
      active,
      completed,
      failed,
    },
  };
}

