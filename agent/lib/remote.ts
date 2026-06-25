// Dispatch jobs to the always-on home Pi worker (over Tailscale Funnel).
// Shared by the remind_me tool and email triage.

export function remoteWorkerConfigured(): boolean {
  return Boolean(process.env.PI_WORKER_URL && process.env.PI_WORKER_SECRET);
}

export async function scheduleRemoteReminder(
  message: string,
  inMinutes: number,
): Promise<{ id: string; fireAt: string }> {
  const url = process.env.PI_WORKER_URL;
  const secret = process.env.PI_WORKER_SECRET;
  if (!url || !secret) {
    throw new Error("Home worker not configured (PI_WORKER_URL / PI_WORKER_SECRET).");
  }
  const res = await fetch(`${url.replace(/\/$/, "")}/jobs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "reminder", message, delaySeconds: Math.round(inMinutes * 60) }),
  });
  if (!res.ok) throw new Error(`Worker ${res.status}: ${await res.text()}`);
  return (await res.json()) as { id: string; fireAt: string };
}

export async function schedulePresenceReminder(
  message: string,
  trigger: "home" | "away",
): Promise<void> {
  const url = process.env.PI_WORKER_URL;
  const secret = process.env.PI_WORKER_SECRET;
  if (!url || !secret) {
    throw new Error("Home worker not configured (PI_WORKER_URL / PI_WORKER_SECRET).");
  }
  const res = await fetch(`${url.replace(/\/$/, "")}/jobs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "presence", message, trigger }),
  });
  if (!res.ok) throw new Error(`Worker ${res.status}: ${await res.text()}`);
}
