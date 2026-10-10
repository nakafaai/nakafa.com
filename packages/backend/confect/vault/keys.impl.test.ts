import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import {
  ensureLearnerKeys,
  readLearnerKeys,
  rewrapLearnerKeys,
} from "@repo/backend/confect/vault/keys";
import { Sealed } from "@repo/backend/confect/vault/schema";
import { openText, sealText } from "@repo/backend/confect/vault/text";
import { TEST_ROOT_KEYS } from "@repo/backend/test/vault";
import { Array as Arr, ConfigProvider, Effect, Schema } from "effect";

const memory = { field: "text", table: "ninaMemories" };
const Learners = Schema.mutable(
  Schema.Array(Schema.Struct({ sealed: Sealed, userId: Id("users") }))
);
const { current, retired } = TEST_ROOT_KEYS;

/** Runs an effect with only the named root keys in the environment. */
const withRoots = (roots: string) =>
  Effect.provide(
    ConfigProvider.layer(ConfigProvider.fromUnknown({ VAULT_ROOT_KEYS: roots }))
  );

/** Creates one account whose key the given root key wraps, and seals its name. */
const learner = Effect.fn("test.vault.rotation.learner")(function* (
  name: string,
  roots: string
) {
  const userId = yield* (yield* DatabaseWriter).table("users").insert({
    authId: `rotation-${name}`,
    credits: 0,
    creditsResetAt: 0,
    email: `${name}@example.com`,
    name,
    plan: "free",
  });
  const keys = yield* ensureLearnerKeys(userId).pipe(withRoots(roots));
  return { sealed: yield* sealText(keys, memory, name), userId };
});

const roots = Effect.fn("test.vault.rotation.roots")(function* () {
  const rows = yield* (yield* DatabaseReader)
    .table("vaultKeys")
    .index("by_creation_time")
    .collect();
  return Arr.map(rows, (row) => row.root);
});

describe("vault root key rotation", () => {
  it.effect(
    "moves every learner key to the current root key, one page per call, and keeps sealed text readable",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect;
        const learners = yield* t.run(
          Effect.gen(function* () {
            const moved = [
              yield* learner("ani", retired),
              yield* learner("budi", retired),
              yield* learner("citra", current),
            ];
            expect(yield* roots()).toEqual(["old", "old", "test"]);
            expect(yield* rewrapLearnerKeys(1)).toBe(1);
            expect(yield* roots()).toEqual(["test", "old", "test"]);
            return moved;
          }).pipe(Effect.orDie),
          Learners
        );
        expect(yield* t.mutation(refs.internal.vault.keys.rewrap, {})).toBe(1);
        expect(yield* t.mutation(refs.internal.vault.keys.rewrap, {})).toBe(0);
        yield* t.run(
          Effect.gen(function* () {
            expect(yield* roots()).toEqual(["test", "test", "test"]);
            for (const { sealed, userId } of learners) {
              const keys = yield* readLearnerKeys(userId).pipe(
                withRoots(current)
              );
              const user = yield* (yield* DatabaseReader)
                .table("users")
                .get(userId);
              expect(yield* openText(keys, memory, sealed)).toBe(user.name);
            }
          }).pipe(Effect.orDie)
        );
      }).pipe(Effect.provide(confectLayer))
  );
});
