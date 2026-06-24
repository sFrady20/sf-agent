// Domain types for the agent's durable memory. Kept storage-agnostic so the
// backend (in-memory, Vercel KV, Postgres) can change without touching callers.

export interface Note {
  id: string;
  text: string;
  tags: string[];
  createdAt: string; // ISO 8601
}

export interface Fact {
  key: string; // short stable label, e.g. "pediatrician"
  value: string;
  updatedAt: string; // ISO 8601
}

export type TaskStatus = "open" | "done";

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  due?: string; // ISO date
  recur?: string; // free-form cadence, e.g. "weekly", "every Tuesday"
  createdAt: string;
  completedAt?: string;
  lastCompletedAt?: string; // recurring chores: last time it was checked off
}
