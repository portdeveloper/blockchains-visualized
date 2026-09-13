import { Block } from "./block";
import { Tx } from "./tx";

export type NodeId = number;
export type MsgKind = "tx" | "block";

export interface Message {
  id: number;
  kind: MsgKind;
  from: NodeId;
  to: NodeId;
  payload: Tx | Block;
  sentAt: number;
  deliverAt: number;
}

/** Point-to-point message bus with per-link latency and optional partitions. */
export class Network {
  private queue: Message[] = [];
  private nextId = 1;
  latency = new Map<string, number>(); // "a-b" → ms
  blocked = new Set<string>();

  private key(a: NodeId, b: NodeId) {
    return a < b ? `${a}-${b}` : `${b}-${a}`;
  }
  setLatency(a: NodeId, b: NodeId, ms: number) {
    this.latency.set(this.key(a, b), ms);
  }
  getLatency(a: NodeId, b: NodeId) {
    return this.latency.get(this.key(a, b)) ?? 100;
  }
  setBlocked(a: NodeId, b: NodeId, blocked: boolean) {
    const k = this.key(a, b);
    if (blocked) this.blocked.add(k);
    else this.blocked.delete(k);
  }
  isBlocked(a: NodeId, b: NodeId) {
    return this.blocked.has(this.key(a, b));
  }

  send(from: NodeId, to: NodeId, kind: MsgKind, payload: Tx | Block, now: number): Message | null {
    if (this.isBlocked(from, to)) return null;
    const m: Message = { id: this.nextId++, kind, from, to, payload, sentAt: now, deliverAt: now + this.getLatency(from, to) };
    this.queue.push(m);
    return m;
  }

  /** Remove and return every message whose delivery time has passed, in delivery order. */
  drain(now: number): Message[] {
    const ready = this.queue.filter((m) => m.deliverAt <= now).sort((a, b) => a.deliverAt - b.deliverAt);
    this.queue = this.queue.filter((m) => m.deliverAt > now);
    return ready;
  }

  inflight(): readonly Message[] {
    return this.queue;
  }
}
