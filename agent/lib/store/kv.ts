// A tiny key/value seam. The whole storage layer sits on these five methods, so
// swapping the backend is a one-file change.
//
// Default: Upstash / Vercel KV over its REST API when KV_REST_API_URL and
// KV_REST_API_TOKEN are set (zero extra dependencies — plain fetch). Otherwise
// an in-memory map for local dev, which does NOT persist across restarts.

export interface Kv {
  get(key: string): Promise<string | null>;
  /** ttlSeconds: auto-expire the key (for dedup marks and other ephemera). */
  set(key: string, value: string, opts?: { ttlSeconds?: number }): Promise<void>;
  del(key: string): Promise<void>;
  keys(prefix: string): Promise<string[]>;
  /** Batched get — one round trip instead of N. Order matches `keys`. */
  mget(keys: string[]): Promise<(string | null)[]>;
}

class MemoryKv implements Kv {
  #map = new Map<string, { value: string; expiresAt?: number }>();
  #live(key: string): string | null {
    const e = this.#map.get(key);
    if (!e) return null;
    if (e.expiresAt && e.expiresAt <= Date.now()) {
      this.#map.delete(key);
      return null;
    }
    return e.value;
  }
  async get(key: string) {
    return this.#live(key);
  }
  async set(key: string, value: string, opts?: { ttlSeconds?: number }) {
    this.#map.set(key, {
      value,
      expiresAt: opts?.ttlSeconds ? Date.now() + opts.ttlSeconds * 1000 : undefined,
    });
  }
  async del(key: string) {
    this.#map.delete(key);
  }
  async keys(prefix: string) {
    return [...this.#map.keys()].filter((k) => k.startsWith(prefix) && this.#live(k) !== null);
  }
  async mget(keys: string[]) {
    return keys.map((k) => this.#live(k));
  }
}

class UpstashKv implements Kv {
  #url: string;
  #token: string;
  constructor(url: string, token: string) {
    this.#url = url.replace(/\/$/, "");
    this.#token = token;
  }
  async #cmd<T>(command: (string | number)[]): Promise<T> {
    const res = await fetch(this.#url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.#token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
    });
    if (!res.ok) {
      throw new Error(`KV ${command[0]} failed: ${res.status} ${res.statusText}`);
    }
    const json = (await res.json()) as { result: T };
    return json.result;
  }
  async get(key: string) {
    return (await this.#cmd<string | null>(["GET", key])) ?? null;
  }
  async set(key: string, value: string, opts?: { ttlSeconds?: number }) {
    const cmd: (string | number)[] = ["SET", key, value];
    if (opts?.ttlSeconds) cmd.push("EX", opts.ttlSeconds);
    await this.#cmd(cmd);
  }
  async del(key: string) {
    await this.#cmd(["DEL", key]);
  }
  async keys(prefix: string) {
    return (await this.#cmd<string[]>(["KEYS", `${prefix}*`])) ?? [];
  }
  async mget(keys: string[]) {
    if (keys.length === 0) return [];
    return (await this.#cmd<(string | null)[]>(["MGET", ...keys])) ?? keys.map(() => null);
  }
}

let warnedMemoryOnly = false;

export function createKv(): Kv {
  // Vercel's KV and the Upstash marketplace integration use different env names.
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return new UpstashKv(url, token);
  if (!warnedMemoryOnly) {
    warnedMemoryOnly = true;
    console.warn(
      "[store] KV_REST_API_URL / KV_REST_API_TOKEN not set — using in-memory store. " +
        "Data will NOT persist across restarts. Set Vercel KV / Upstash REST creds for durability.",
    );
  }
  return new MemoryKv();
}
