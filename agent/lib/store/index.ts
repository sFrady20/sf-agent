// The agent's durable memory, assembled once and imported wherever it's needed.
//
//   import { store } from "../lib/store/index.js";
//   await store.notes.add("buy diapers");
//
// This is cross-session memory (it outlives a conversation). For conversation-
// scoped working memory, use defineState from "eve/context" instead.

import { createKv } from "./kv.js";
import { createFacts, createNotes, createTasks } from "./repositories.js";

const kv = createKv();

export const store = {
  kv,
  notes: createNotes(kv),
  facts: createFacts(kv),
  tasks: createTasks(kv),
};

export type Store = typeof store;
export type { Fact, Note, Task, TaskStatus } from "./types.js";
