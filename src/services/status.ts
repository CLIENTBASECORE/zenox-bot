import { db } from '../database/db.js';
import { NodeStatus, DomainMirror } from '../types/index.js';
import { DEFAULT_MIRRORS } from '../utils/branding.js';

export class StatusService {
  public static async refreshStatus(): Promise<NodeStatus[]> {
    const nodes = db.getSystemNodes();

    // Simulate minor dynamic latency shifts (realistic network jitter)
    for (const node of nodes) {
      if (node.status !== 'offline') {
        const jitter = Math.floor(Math.random() * 10) - 5;
        const newLat = Math.max(12, node.latencyMs + jitter);
        db.updateNodeHealth(node.id, node.status, newLat);
      }
    }

    return db.getSystemNodes();
  }

  public static getNodes(): NodeStatus[] {
    return db.getSystemNodes();
  }

  public static getMirrors(): DomainMirror[] {
    return DEFAULT_MIRRORS;
  }

  public static getOverallHealth(): {
    status: 'optimal' | 'degraded' | 'critical';
    averageLatency: number;
    onlineCount: number;
    totalCount: number;
  } {
    const nodes = db.getSystemNodes();
    const online = nodes.filter(n => n.status === 'online').length;
    const total = nodes.length;
    const avgLat = Math.round(nodes.reduce((acc, n) => acc + n.latencyMs, 0) / (total || 1));

    let status: 'optimal' | 'degraded' | 'critical' = 'optimal';
    if (online < total * 0.7) {
      status = 'critical';
    } else if (online < total) {
      status = 'degraded';
    }

    return {
      status,
      averageLatency: avgLat,
      onlineCount: online,
      totalCount: total,
    };
  }
}
