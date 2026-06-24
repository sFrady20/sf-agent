// A tiny key/value seam. The whole storage layer sits on these four methods, so
// swapping the backend is a one-file change.
//
// Default: Upstash / Vercel KV over its REST API when KV_REST_API_URL and
// KV_REST_API_TOKEN are set (zero extra dependencies — plain fetch). Otherwise
// an in-memory map for local dev, which does NOT persist across restarts.

export interface Kv {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  del(key: string): Promise<void>;
  keys(prefix: string): Promise<string[]>;
}

class MemoryKv implements Kv {
  #map = new Map<string, string>();
  async get(key: string) {
    return this.#map.get(key) ?? null;
  }
  async set(key: string, value: string) {
    this.#map.set(key, value);
  }
  async del(key: string) {
    this.#map.delete(key);
  }
  async keys(prefix: string) {
    return [...this.#map.keys()].filter((k) => k.startsWith(prefix));
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
  async set(key: string, value: string) {
    await this.#cmd(["SET", key, value]);
  }
  async del(key: string) {
    await this.#cmd(["DEL", key]);
  }
  async keys(prefix: string) {
    return (await this.#cmd<string[]>(["KEYS", `${prefix}*`])) ?? [];
  }
}

let warnedMemoryOnly = false;

export function createKv(): Kv {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
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
