// Calls to the always-on home Pi worker (over Tailscale Funnel). Every call has a
// timeout so a wedged/dead worker returns an error instead of hanging the turn.

const WORKER_TIMEOUT_MS = 8000;

export function remoteWorkerConfigured(): boolean {
  return Boolean(process.env.PI_WORKER_URL && process.env.PI_WORKER_SECRET);
}

export async function workerFetch(
  path: string,
  init: { method?: string; body?: string } = {},
): Promise<Response> {
  const url = process.env.PI_WORKER_URL;
  const secret = process.env.PI_WORKER_SECRET;
  if (!url || !secret) {
    throw new Error("Home worker not configured (PI_WORKER_URL / PI_WORKER_SECRET).");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WORKER_TIMEOUT_MS);
  try {
    return await fetch(`${url.replace(/\/$/, "")}${path}`, {
      method: init.method ?? "GET",
      body: init.body,
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      signal: controller.signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new Error("Home worker timed out (no response).");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function scheduleRemoteReminder(
  message: string,
  inMinutes: number,
): Promise<{ id: string; fireAt: string }> {
  const res = await workerFetch("/jobs", {
    method: "POST",
    body: JSON.stringify({ type: "reminder", message, delaySeconds: Math.round(inMinutes * 60) }),
  });
  if (!res.ok) throw new Error(`Worker ${res.status}: ${await res.text()}`);
  return (await res.json()) as { id: string; fireAt: string };
}

export async function schedulePresenceReminder(
  message: string,
  trigger: "home" | "away",
): Promise<void> {
  const res = await workerFetch("/jobs", {
    method: "POST",
    body: JSON.stringify({ type: "presence", message, trigger }),
  });
  if (!res.ok) throw new Error(`Worker ${res.status}: ${await res.text()}`);
}
