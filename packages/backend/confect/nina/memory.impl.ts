import { FunctionImpl, GroupImpl } from "@confect/server";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import schema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  getOptionalAppUserForRead,
  requireAuth,
} from "@repo/backend/confect/auth/session";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { readLearnerProfile } from "@repo/backend/confect/nina/memory/profile";
import { findMemory } from "@repo/backend/confect/nina/memory/store";
import spec, {
  MEMORY_FACTS,
  type NinaMemoryChanges,
} from "@repo/backend/confect/nina/memory.spec";
import { Clock, Effect, Layer } from "effect";

type Memory = Docs["ninaMemories"];

/** Lists facts for settings, most recently saved first. */
function toView(facts: Memory["facts"]) {
  return {
    facts: [...facts].reverse().map(({ key, savedAt, text }) => ({
      key,
      savedAt,
      text,
    })),
  };
}

/**
 * Applies curated changes. Rewritten and new facts move to the recent end, a
 * new fact that repeats a kept one is skipped, and the least recently saved
 * facts beyond the cap leave.
 */
function reviseFacts(
  memory: Memory,
  changes: typeof NinaMemoryChanges.Type,
  source: {
    readonly chatId: Memory["facts"][number]["chatId"];
    readonly savedAt: number;
  }
) {
  const forgotten = new Set(changes.forget);
  const updates = new Map(changes.update.map(({ key, text }) => [key, text]));
  const kept: Memory["facts"] = [];
  const rewritten: Memory["facts"] = [];
  for (const fact of memory.facts) {
    if (forgotten.has(fact.key)) {
      continue;
    }
    const text = updates.get(fact.key);
    if (text === undefined) {
      kept.push(fact);
    } else {
      rewritten.push({ ...source, key: fact.key, text });
    }
  }
  const known = new Set(
    [...kept, ...rewritten].map((fact) => fact.text.toLowerCase())
  );
  const added: Memory["facts"] = [];
  for (const text of changes.remember) {
    if (!known.has(text.toLowerCase())) {
      known.add(text.toLowerCase());
      added.push({ ...source, key: memory.next + added.length, text });
    }
  }
  return {
    facts: [...kept, ...rewritten, ...added].slice(-MEMORY_FACTS),
    next: memory.next + added.length,
  };
}

const get = FunctionImpl.make(
  schema,
  spec,
  "get",
  Effect.fn("nina.memory.get")(function* () {
    const user = yield* getOptionalAppUserForRead();
    if (!user) {
      return null;
    }
    const memory = yield* findMemory(user.appUser._id);
    return memory ? toView(memory.facts) : null;
  })
);

const enable = FunctionImpl.make(
  schema,
  spec,
  "enable",
  Effect.fn("nina.memory.enable")(function* () {
    const { appUser } = yield* requireAuth();
    const memory = yield* findMemory(appUser._id);
    if (memory) {
      return toView(memory.facts);
    }
    yield* (yield* DatabaseWriter)
      .table("ninaMemories")
      .insert({
        facts: [],
        next: 0,
        updatedAt: yield* Clock.currentTimeMillis,
        usage: { calls: 0, input: 0, output: 0 },
        userId: appUser._id,
      })
      .pipe(Effect.orDie);
    return toView([]);
  })
);

/** Turning memory off forgets every fact at once. */
const disable = FunctionImpl.make(
  schema,
  spec,
  "disable",
  Effect.fn("nina.memory.disable")(function* () {
    const { appUser } = yield* requireAuth();
    const memory = yield* findMemory(appUser._id);
    if (memory) {
      yield* (yield* DatabaseWriter)
        .table("ninaMemories")
        .delete(memory._id)
        .pipe(Effect.orDie);
    }
    return null;
  })
);

const forget = FunctionImpl.make(
  schema,
  spec,
  "forget",
  Effect.fn("nina.memory.forget")(function* ({ key }) {
    const { appUser } = yield* requireAuth();
    const memory = yield* findMemory(appUser._id);
    if (!memory) {
      return null;
    }
    const facts = memory.facts.filter((fact) => fact.key !== key);
    if (facts.length < memory.facts.length) {
      yield* (yield* DatabaseWriter)
        .table("ninaMemories")
        .patch(memory._id, {
          facts,
          updatedAt: yield* Clock.currentTimeMillis,
        })
        .pipe(Effect.orDie);
    }
    return toView(facts);
  })
);

const read = FunctionImpl.make(
  schema,
  spec,
  "read",
  Effect.fn("nina.memory.read")(function* ({ userId }) {
    const profile = yield* readLearnerProfile(userId);
    const memory = yield* findMemory(userId);
    return {
      memory: memory
        ? {
            facts: memory.facts.map(({ key, text }) => ({ key, text })),
            id: memory._id,
            revision: memory.updatedAt,
          }
        : null,
      profile,
    };
  })
);

/**
 * Stores one curation. Memory turned off meanwhile keeps nothing. The call's
 * usage always counts, but its changes apply only to the memory and revision
 * it read, so a curation that raced memory being reset, a newer curation, or
 * a fact the learner forgot changes nothing, and a chat deleted meanwhile
 * leaves no facts behind.
 */
const apply = FunctionImpl.make(
  schema,
  spec,
  "apply",
  Effect.fn("nina.memory.apply")(function* ({
    changes,
    chatId,
    memory: read,
    usage: call,
    userId,
  }) {
    const memory = yield* findMemory(userId);
    if (!memory) {
      return null;
    }
    const chat = yield* (yield* DatabaseReader)
      .table("chats")
      .get(chatId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    const current =
      memory._id === read.id && memory.updatedAt === read.revision;
    const savedAt = yield* Clock.currentTimeMillis;
    const { facts, next } =
      chat && current
        ? reviseFacts(memory, changes, { chatId, savedAt })
        : memory;
    yield* (yield* DatabaseWriter)
      .table("ninaMemories")
      .patch(memory._id, {
        facts,
        next,
        updatedAt: savedAt,
        usage: {
          calls: memory.usage.calls + 1,
          input: memory.usage.input + call.input,
          output: memory.usage.output + call.output,
        },
      })
      .pipe(Effect.orDie);
    return null;
  })
);

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(get),
  Layer.provide(enable),
  Layer.provide(disable),
  Layer.provide(forget),
  Layer.provide(read),
  Layer.provide(apply),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
