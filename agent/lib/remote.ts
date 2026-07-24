// Calls to the always-on home Pi worker (over Tailscale Funnel). Every call has a
// timeout so a wedged/dead worker returns an error instead of hanging the turn.

const WORKER_TIMEOUT_MS = 8000;

export function remoteWorkerConfigured(): boolean {
  return Boolean(process.env.PI_WORKER_URL && process.env.PI_WORKER_SECRET);
}

export async function workerFetch(
  path: string,
  init: { method?: string; body?: string; timeoutMs?: number } = {},
): Promise<Response> {
  const url = process.env.PI_WORKER_URL;
  const secret = process.env.PI_WORKER_SECRET;
  if (!url || !secret) {
    throw new Error("Home worker not configured (PI_WORKER_URL / PI_WORKER_SECRET).");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? WORKER_TIMEOUT_MS);
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

export interface PendingReminders {
  timed: Array<{ id: string; message: string; fireAt: string }>;
  presence: Array<{ id: string; message: string; trigger: "home" | "away"; createdAt: string }>;
}

export async function listRemoteReminders(): Promise<PendingReminders> {
  const res = await workerFetch("/jobs");
  if (!res.ok) throw new Error(`Worker ${res.status}: ${await res.text()}`);
  return (await res.json()) as PendingReminders;
}

export async function cancelRemoteReminder(id: string): Promise<boolean> {
  const res = await workerFetch(`/jobs/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`Worker ${res.status}: ${await res.text()}`);
  return true;
}

// --- Parking camera (Wyze cam via docker-wyze-bridge on the Pi) ---

export interface ParkingResult {
  open: number;
  total: number;
  detail: string;
  at: string;
}

export interface ParkingStatus {
  configured: boolean;
  last: ParkingResult | null;
  watch: { endsAt: string; intervalSeconds: number; stopWhenOpen: boolean; checks: number } | null;
}

// A check is snapshot + one vision call on the Pi — allow well past the 8s default.
const PARKING_CHECK_TIMEOUT_MS = 75_000;

export async function checkRemoteParking(): Promise<ParkingResult> {
  const res = await workerFetch("/camera/parking/check", {
    method: "POST",
    body: "{}",
    timeoutMs: PARKING_CHECK_TIMEOUT_MS,
  });
  if (!res.ok) throw new Error(`Worker ${res.status}: ${await res.text()}`);
  return (await res.json()) as ParkingResult;
}

export async function remoteParkingStatus(): Promise<ParkingStatus> {
  const res = await workerFetch("/camera/parking");
  if (!res.ok) throw new Error(`Worker ${res.status}: ${await res.text()}`);
  return (await res.json()) as ParkingStatus;
}

export async function watchRemoteParking(input: {
  minutes?: number;
  intervalSeconds?: number;
  stopWhenOpen?: boolean;
}): Promise<{ endsAt: string; intervalSeconds: number }> {
  const res = await workerFetch("/camera/parking/watch", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Worker ${res.status}: ${await res.text()}`);
  return (await res.json()) as { endsAt: string; intervalSeconds: number };
}

export async function stopRemoteParkingWatch(): Promise<boolean> {
  const res = await workerFetch("/camera/parking/watch", { method: "DELETE" });
  if (!res.ok) throw new Error(`Worker ${res.status}: ${await res.text()}`);
  return ((await res.json()) as { stopped: boolean }).stopped;
}
