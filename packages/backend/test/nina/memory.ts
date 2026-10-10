import { RegisteredConvexFunction } from "@confect/server";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import schema from "@repo/backend/confect/_generated/schema";
import { MEMORY_FIELD } from "@repo/backend/confect/nina/memory/seal";
import type { NinaMemory } from "@repo/backend/confect/nina/memory.spec";
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
 * Inserts one memory for a learner. Nina wrote it, with a kind, unless the row
 * says otherwise. A memory the learner wrote has no kind unless the row names
 * one.
 */
export async function insertMemory(
  ctx: MutationCtx,
  {
    author = "nina",
    confirmedAt = 1,
    kind = author === "nina" ? "goal" : undefined,
    lesson,
    text = "Mau ikut SNBT 2027.",
    userId,
    validUntil,
  }: {
    readonly author?: typeof NinaMemory.Type.author;
    readonly confirmedAt?: number;
    readonly kind?: typeof NinaMemory.Type.kind;
    readonly lesson?: string;
    readonly text?: string;
    readonly userId: UserId;
    readonly validUntil?: number;
  }
) {
  const sealed = await run(
    ctx,
    Effect.flatMap(ensureLearnerKeys(userId), (keys) =>
      sealText(keys, MEMORY_FIELD, text)
    )
  );
  return ctx.db.insert("ninaMemories", {
    author,
    confirmedAt,
    ...(kind === undefined ? {} : { kind }),
    ...(lesson === undefined ? {} : { lesson }),
    text: sealed,
    userId,
    ...(validUntil === undefined ? {} : { validUntil }),
  });
}

type Seed = Partial<Parameters<typeof insertMemory>[1]>;
type NinaTest = Awaited<ReturnType<typeof createNinaTest>>;

/**
 * Helpers for the memory table of a Nina fixture. Memories seeded here are
 * sealed exactly as the product seals them, so they open through the public
 * functions.
 */
export function memoryTools(f: NinaTest) {
  /** Inserts one memory, Nina's own unless the seed says otherwise. */
  const seed = ({ userId = f.identity.userId, ...row }: Seed = {}) =>
    f.t.mutation((ctx) => insertMemory(ctx, { ...row, userId }));

  /** Inserts `count` memories in one step, each confirmed after the one before. */
  const fill = (
    count: number,
    { userId = f.identity.userId, ...row }: Seed = {}
  ) =>
    f.t.mutation(async (ctx) => {
      for (let index = 0; index < count; index += 1) {
        await insertMemory(ctx, {
          ...row,
          confirmedAt: index + 1,
          text: `Memory ${index}`,
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

  /** Puts the turn's learner on the lesson page that this asset id names. */
  const openLesson = (assetId: string) =>
    f.t.mutation(async (ctx) => {
      const turn = await ctx.db.get("ninaTurns", f.turnId);
      const page = Option.getOrThrow(Option.fromNullishOr(turn?.page));
      await ctx.db.patch("ninaTurns", f.turnId, {
        page: {
          ...page,
          nina: {
            ...page.nina,
            learning: { ...page.nina.learning, assetId },
          },
        },
      });
    });

  /** Every stored memory row, as stored. */
  const stored = () =>
    f.t.query((ctx) => ctx.db.query("ninaMemories").collect());

  /** The opened text of every stored memory of a learner, in storage order. */
  const texts = (userId: UserId = f.identity.userId) =>
    f.t.mutation(async (ctx) => {
      const rows = Arr.filter(
        await ctx.db.query("ninaMemories").collect(),
        (row) => row.userId === userId
      );
      return run(
        ctx,
        Effect.flatMap(readLearnerKeys(userId), (keys) =>
          Effect.forEach(rows, (row) => openText(keys, MEMORY_FIELD, row.text))
        )
      );
    });

  return { fill, openLesson, seed, stored, stranger, texts };
}

/** A Nina fixture together with its memory helpers. */
export async function createMemoryTest(
  options?: Parameters<typeof createNinaTest>[0]
) {
  const f = await createNinaTest(options);
  return { ...f, ...memoryTools(f) };
}
