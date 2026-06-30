// Typed repositories over the Kv seam. Each one owns a key prefix and the
// JSON (de)serialization for its entity. Tools, schedules, and hooks talk to
// these, never to raw keys.

import { randomUUID } from "node:crypto";
import type { Kv } from "./kv.js";
import type { Fact, Location, Note, Task, WorkSchedule } from "./types.js";

const now = () => new Date().toISOString();

async function readAll<T>(kv: Kv, prefix: string): Promise<T[]> {
  const keys = await kv.keys(prefix);
  const raw = await Promise.all(keys.map((k) => kv.get(k)));
  return raw.filter((v): v is string => v !== null).map((v) => JSON.parse(v) as T);
}

export function createNotes(kv: Kv) {
  const prefix = "note:";
  return {
    async add(text: string, tags: string[] = []): Promise<Note> {
      const note: Note = { id: randomUUID(), text, tags, createdAt: now() };
      await kv.set(prefix + note.id, JSON.stringify(note));
      return note;
    },
    async list(): Promise<Note[]> {
      const notes = await readAll<Note>(kv, prefix);
      return notes.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async delete(id: string): Promise<boolean> {
      const key = prefix + id;
      if ((await kv.get(key)) === null) return false;
      await kv.del(key);
      return true;
    },
  };
}

export function createFacts(kv: Kv) {
  const prefix = "fact:";
  return {
    async set(key: string, value: string): Promise<Fact> {
      const fact: Fact = { key, value, updatedAt: now() };
      await kv.set(prefix + key, JSON.stringify(fact));
      return fact;
    },
    async get(key: string): Promise<Fact | null> {
      const raw = await kv.get(prefix + key);
      return raw ? (JSON.parse(raw) as Fact) : null;
    },
    async all(): Promise<Fact[]> {
      return readAll<Fact>(kv, prefix);
    },
  };
}

export function createReminders(kv: Kv) {
  const prefix = "reminded:";
  return {
    // Has this exact reminder already fired? Keys are caller-defined and stable,
    // e.g. `task:<id>:<due>` or `appt:<id>:<start>`.
    async was(key: string): Promise<boolean> {
      return (await kv.get(prefix + key)) !== null;
    },
    async mark(key: string): Promise<void> {
      await kv.set(prefix + key, new Date().toISOString());
    },
  };
}

export function createLocation(kv: Kv) {
  const key = "settings:location"; // single value, not a list
  return {
    async get(): Promise<Location | null> {
      const raw = await kv.get(key);
      return raw ? (JSON.parse(raw) as Location) : null;
    },
    async set(input: Omit<Location, "setAt">): Promise<Location> {
      const loc: Location = { ...input, setAt: now() };
      await kv.set(key, JSON.stringify(loc));
      return loc;
    },
    async clear(): Promise<void> {
      await kv.del(key);
    },
  };
}

export function createWorkSchedule(kv: Kv) {
  const key = "settings:work_schedule"; // single swappable record
  return {
    async get(): Promise<WorkSchedule | null> {
      const raw = await kv.get(key);
      return raw ? (JSON.parse(raw) as WorkSchedule) : null;
    },
    async set(input: Omit<WorkSchedule, "updatedAt">): Promise<WorkSchedule> {
      const sched: WorkSchedule = { ...input, updatedAt: now() };
      await kv.set(key, JSON.stringify(sched));
      return sched;
    },
    async clear(): Promise<void> {
      await kv.del(key);
    },
  };
}

export function createTasks(kv: Kv) {
  const prefix = "task:";
  return {
    async add(input: {
      title: string;
      due?: string;
      recur?: string;
      stakes?: "low" | "high";
    }): Promise<Task> {
      const task: Task = {
        id: randomUUID(),
        title: input.title,
        status: "open",
        due: input.due,
        recur: input.recur,
        stakes: input.stakes ?? "low",
        createdAt: now(),
      };
      await kv.set(prefix + task.id, JSON.stringify(task));
      return task;
    },
    async list(opts: { includeCompleted?: boolean } = {}): Promise<Task[]> {
      const tasks = await readAll<Task>(kv, prefix);
      const filtered = opts.includeCompleted ? tasks : tasks.filter((t) => t.status === "open");
      return filtered.sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"));
    },
    async get(id: string): Promise<Task | null> {
      const raw = await kv.get(prefix + id);
      return raw ? (JSON.parse(raw) as Task) : null;
    },
    async save(task: Task): Promise<void> {
      await kv.set(prefix + task.id, JSON.stringify(task));
    },
    async complete(id: string): Promise<Task | null> {
      return closeTask(kv, prefix, id, "done");
    },
    // Close for any reason: explicit "done", silently "assumed", or a passive
    // signal ("email" / "calendar"). All recoverable via reopen.
    async close(id: string, reason: NonNullable<Task["closedReason"]>): Promise<Task | null> {
      return closeTask(kv, prefix, id, reason);
    },
    async reopen(id: string): Promise<Task | null> {
      const raw = await kv.get(prefix + id);
      if (!raw) return null;
      const task = JSON.parse(raw) as Task;
      task.status = "open";
      delete task.completedAt;
      delete task.closedReason;
      await kv.set(prefix + id, JSON.stringify(task));
      return task;
    },
  };
}

async function closeTask(
  kv: Kv,
  prefix: string,
  id: string,
  reason: NonNullable<Task["closedReason"]>,
): Promise<Task | null> {
  const raw = await kv.get(prefix + id);
  if (!raw) return null;
  const task = JSON.parse(raw) as Task;
  task.status = "done";
  task.completedAt = now();
  task.closedReason = reason;
  await kv.set(prefix + id, JSON.stringify(task));
  return task;
}
