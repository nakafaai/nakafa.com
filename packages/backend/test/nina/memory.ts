import { Ref } from "@confect/core";
import { RegisteredConvexFunction } from "@confect/server";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import schema from "@repo/backend/confect/_generated/schema";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { setNinaMemoryCleared } from "@repo/backend/confect/learningPreferences/impl";
import { syncKeys, wordKey } from "@repo/backend/confect/nina/memory/keys";
import {
  MEMORY_FIELD,
  TITLE_FIELD,
} from "@repo/backend/confect/nina/memory/seal";
import { searchMemories } from "@repo/backend/confect/nina/memory/search";
import {
  deleteBatch,
  readMemoryState,
} from "@repo/backend/confect/nina/memory/store";
import { recallLearner } from "@repo/backend/confect/nina/memory/turn";
import {
  MEMORY_KNOWN_LIMIT,
  type NinaMemory,
  type NinaMemoryCandidate,
  type NinaMemorySeen,
} from "@repo/backend/confect/nina/memory.spec";
import { seedAuthenticatedUser } from "@repo/backend/confect/test.helpers";
import {
  ensureLearnerKeys,
  readLearnerKeys,
} from "@repo/backend/confect/vault/keys";
import { openText, sealText } from "@repo/backend/confect/vault/text";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { createNinaTest } from "@repo/backend/test/nina";
import { Array as Arr, DateTime, Effect, Option } from "effect";

type UserId = Docs["users"]["_id"];
type Candidate = typeof NinaMemoryCandidate.Type;

/** What a visitor meets on a write: the typed failure of a missing session. */
export const sessionRequired = { data: { _tag: "SessionRequired" } };

/** Runs a database effect inside a test mutation. A failure fails the test. */
function run<A, E>(
  ctx: MutationCtx,
  effect: Effect.Effect<
    A,
    E,
    RegisteredConvexFunction.MutationServices<typeof schema>
  >
) {
  return Effect.runPromise(
    effect.pipe(
      Effect.orDie,
      Effect.provide(RegisteredConvexFunction.mutationLayer(schema, ctx))
    )
  );
}

/**
 * What a turn knows about a learner, read the way the brief of a turn reads it
 * (`recallLearner`), in a test mutation.
 */
export function readLearner(
  f: Pick<Awaited<ReturnType<typeof createNinaTest>>, "t">,
  args: Parameters<typeof recallLearner>[0]
) {
  return f.t.mutation((ctx) => run(ctx, recallLearner(args)));
}

/**
 * Inserts one memory for a learner and indexes it as the product does. Nina
 * wrote it, with a kind, unless the row says otherwise. A memory the learner
 * wrote has no kind unless the row names one, and has no title unless the row
 * gives one. The words and the title are sealed in their own fields, as the
 * product seals them.
 */
export function insertMemory(
  ctx: MutationCtx,
  {
    author = "nina",
    confirmedAt = 1,
    kind = author === "nina" ? "goal" : undefined,
    text = "Mau ikut SNBT 2027.",
    title,
    topics,
    userId,
    validUntil,
  }: {
    readonly author?: typeof NinaMemory.Type.author;
    readonly confirmedAt?: number;
    readonly kind?: typeof NinaMemory.Type.kind;
    readonly text?: string;
    readonly title?: string;
    readonly topics?: readonly string[];
    readonly userId: UserId;
    readonly validUntil?: number;
  }
) {
  return run(
    ctx,
    Effect.gen(function* () {
      const keys = yield* ensureLearnerKeys(userId);
      const id = yield* (yield* DatabaseWriter).table("ninaMemories").insert({
        author,
        confirmedAt,
        ...(kind === undefined ? {} : { kind }),
        text: yield* sealText(keys, MEMORY_FIELD, text),
        ...(title === undefined
          ? {}
          : { title: yield* sealText(keys, TITLE_FIELD, title) }),
        ...(topics === undefined ? {} : { topics: [...topics] }),
        userId,
        ...(validUntil === undefined ? {} : { validUntil }),
      });
      yield* syncKeys(keys, id, { confirmedAt, text, title, topics });
      return id;
    })
  );
}

type Seed = Partial<Parameters<typeof insertMemory>[1]>;
type NinaTest = Awaited<ReturnType<typeof createNinaTest>>;

/**
 * Helpers for the memory tables of a Nina fixture. Memories seeded here are
 * sealed and indexed exactly as the product does it, so they open and are found
 * through the public functions.
 */
export function memoryTools(f: NinaTest) {
  /** Inserts one memory, Nina's own unless the seed says otherwise. */
  const seed = ({ userId = f.identity.userId, ...row }: Seed = {}) =>
    f.t.mutation((ctx) => insertMemory(ctx, { ...row, userId }));

  /**
   * Inserts `count` memories in one step, each confirmed after the one before.
   * They read `Memory 0`, `Memory 1` and so on, unless the seed gives them all
   * one text.
   */
  const fill = (
    count: number,
    { userId = f.identity.userId, ...row }: Seed = {}
  ) =>
    f.t.mutation(async (ctx) => {
      for (let index = 0; index < count; index += 1) {
        await insertMemory(ctx, {
          text: `Memory ${index}`,
          ...row,
          confirmedAt: index + 1,
          userId,
        });
      }
    });

  /** A second learner with an identity of their own. */
  const stranger = async () => {
    const seeded = await f.t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, {
        now: DateTime.toEpochMillis(DateTime.nowUnsafe()),
        suffix: "stranger",
      })
    );
    return {
      owner: f.t.withIdentity({
        sessionId: seeded.sessionId,
        subject: seeded.authUserId,
      }),
      userId: seeded.userId,
    };
  };

  /** Puts the turn's learner on the page at `slug` that shows the lesson this asset id names. */
  const openLesson = (assetId: string, slug = "home") =>
    f.t.mutation(async (ctx) => {
      const turn = await ctx.db.get("ninaTurns", f.turnId);
      const page = Option.getOrThrow(Option.fromNullishOr(turn?.page));
      await ctx.db.patch("ninaTurns", f.turnId, {
        page: {
          ...page,
          nina: {
            ...page.nina,
            learning: { ...page.nina.learning, assetId, slug },
          },
          slug,
        },
      });
    });

  /** Every stored memory row, as stored. */
  const stored = () =>
    f.t.query((ctx) => ctx.db.query("ninaMemories").collect());

  /** Every stored key row of the index. */
  const keys = () =>
    f.t.query((ctx) => ctx.db.query("ninaMemoryKeys").collect());

  /** Every stored restore record: a deleted memory kept for its Undo. */
  const restores = () =>
    f.t.query((ctx) => ctx.db.query("ninaMemoryRestores").collect());

  /** One stored memory row as stored, or nothing when it is gone. */
  const rowOf = (id: Docs["ninaMemories"]["_id"]) =>
    f.t.query((ctx) => ctx.db.get("ninaMemories", id));

  /** The opened text of every stored memory of a learner, in storage order. */
  const texts = (userId: UserId = f.identity.userId) =>
    f.t.mutation(async (ctx) => {
      const rows = Arr.filter(
        await ctx.db.query("ninaMemories").collect(),
        (row) => row.userId === userId
      );
      return run(
        ctx,
        Effect.flatMap(readLearnerKeys(userId), (learner) =>
          Effect.forEach(rows, (row) =>
            openText(learner, MEMORY_FIELD, row.text)
          )
        )
      );
    });

  /**
   * The opened title of every stored memory of a learner, in storage order:
   * `null` for a memory that has none, because a Convex result has no
   * `undefined`.
   */
  const titles = (userId: UserId = f.identity.userId) =>
    f.t.mutation(async (ctx) => {
      const rows = Arr.filter(
        await ctx.db.query("ninaMemories").collect(),
        (row) => row.userId === userId
      );
      return run(
        ctx,
        Effect.flatMap(readLearnerKeys(userId), (learner) =>
          Effect.forEach(rows, ({ title }) =>
            title === undefined
              ? Effect.succeed(null)
              : openText(learner, TITLE_FIELD, title)
          )
        )
      );
    });

  /** Runs a database effect in a mutation of the fixture's deployment. */
  const execute = <A, E>(
    effect: Effect.Effect<
      A,
      E,
      RegisteredConvexFunction.MutationServices<typeof schema>
    >
  ) => f.t.mutation((ctx) => run(ctx, effect));

  /**
   * Records that the learner asked to delete every memory at `now`, as `clear`
   * does before its batches run, and deletes nothing. The memories the learner
   * had stay stored, as they do until the batches have run.
   */
  const markCleared = (now: number, userId: UserId = f.identity.userId) =>
    execute(setNinaMemoryCleared({ now, userId }));

  /**
   * The words of the memories that the search finds for a learner, in the order
   * it returns them. Like every caller of the search, it first reads what the
   * learner deleted with "Delete all".
   */
  const find = (
    options: Omit<
      Parameters<typeof searchMemories>[0],
      "clearedAt" | "userId"
    > & {
      readonly userId?: UserId;
    }
  ) =>
    execute(
      Effect.gen(function* () {
        const userId = options.userId ?? f.identity.userId;
        const { clearedAt } = yield* readMemoryState(userId);
        const found = yield* searchMemories({ ...options, clearedAt, userId });
        return Arr.map(found, (memory) => memory.text);
      })
    );

  /** The key a learner's index holds for one word, as the product makes it. */
  const wordKeyOf = (word: string, userId: UserId = f.identity.userId) =>
    execute(
      Effect.flatMap(readLearnerKeys(userId), (learner) =>
        wordKey(learner, word)
      )
    );

  return {
    execute,
    fill,
    find,
    keys,
    markCleared,
    openLesson,
    restores,
    rowOf,
    seed,
    stored,
    stranger,
    texts,
    titles,
    wordKeyOf,
  };
}

/** A Nina fixture together with its memory helpers. */
export async function createMemoryTest(
  options?: Parameters<typeof createNinaTest>[0]
) {
  const f = await createNinaTest(options);
  return { ...f, ...memoryTools(f) };
}

/**
 * Deletes one batch of a learner's memories with no moment bounding it, as the
 * account deletion of `auth/cleanup/social.ts` does, in one convex-test mutation
 * the way a Confect mutation runs it. It returns how many it deleted.
 */
export function deleteAccountBatch(
  f: Awaited<ReturnType<typeof createNinaTest>>,
  userId: Docs["users"]["_id"]
) {
  return f.t.run((ctx) =>
    Effect.runPromise(
      deleteBatch(userId).pipe(
        Effect.provide(RegisteredConvexFunction.mutationLayer(schema, ctx))
      )
    )
  );
}

const capture = Ref.getFunctionReference(refs.internal.nina.memory.capture);

/** A candidate that states a level, or any other kind that never ends, with any field replaced. */
export function candidate(
  fields: Partial<Exclude<Candidate, { kind: "situation" }>> = {}
): Candidate {
  return {
    kind: "level",
    quote: "aku kelas 12",
    text: "Kelas 12 IPA.",
    ...fields,
  };
}

/** A candidate that states a situation, which ends on 20 October 2026 unless `until` says another day. */
export function situation(
  fields: Partial<Extract<Candidate, { kind: "situation" }>> = {}
): Candidate {
  return {
    kind: "situation",
    quote: "ulangan kimia",
    text: "Ulangan kimia.",
    until: "2026-10-20",
    ...fields,
  };
}

/**
 * A memory fixture that also runs one capture write for its turn. `seen` is
 * what the capture call read before the model read the message: the first
 * twelve memories of the learner when the run starts, unless a test names
 * others.
 */
export async function createCaptureTest() {
  const f = await createMemoryTest();
  const readNow = async () =>
    Arr.take(
      Arr.map(
        Arr.filter(
          await f.stored(),
          ({ userId }) => userId === f.identity.userId
        ),
        ({ _id, confirmedAt }) => ({ confirmedAt, id: _id })
      ),
      MEMORY_KNOWN_LIMIT
    );
  const run = async (
    candidates: Candidate[],
    {
      seen,
      topics = [],
    }: { seen?: (typeof NinaMemorySeen.Type)[]; topics?: string[] } = {}
  ) =>
    f.t.mutation(capture, {
      candidates,
      seen: seen ?? (await readNow()),
      topics,
      turnId: f.turnId,
      userId: f.identity.userId,
    });
  const remembered = async () =>
    (await f.t.query((ctx) => ctx.db.get("ninaTurns", f.turnId)))?.remembered;
  return { ...f, remembered, run };
}
