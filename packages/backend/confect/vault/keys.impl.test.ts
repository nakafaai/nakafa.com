import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import {
  readLearnerKeys,
  readTenantKeys,
} from "@repo/backend/confect/vault/keys";
import { rewrapKeys } from "@repo/backend/confect/vault/rewrap";
import { Sealed } from "@repo/backend/confect/vault/schema";
import { openText } from "@repo/backend/confect/vault/text";
import { learnerUnder, memory, schoolUnder } from "@repo/backend/test/owner";
import { TEST_ROOT_KEYS, withRoots } from "@repo/backend/test/vault";
import { Array as Arr, Effect, Schema } from "effect";

const Learners = Schema.mutable(
  Schema.Array(Schema.Struct({ sealed: Sealed, userId: Id("users") }))
);
const Moved = Schema.Struct({
  learners: Learners,
  school: Schema.Struct({ sealed: Sealed, tenantId: Id("tenants") }),
});
const { current, retired } = TEST_ROOT_KEYS;

const roots = Effect.fn("test.vault.rotation.roots")(function* () {
  const rows = yield* (yield* DatabaseReader)
    .table("vaultKeys")
    .index("by_creation_time")
    .collect();
  return Arr.map(rows, (row) => row.root);
});

const schoolRoots = Effect.fn("test.vault.rotation.schoolRoots")(function* () {
  const rows = yield* (yield* DatabaseReader)
    .table("tenantKeys")
    .index("by_creation_time")
    .collect();
  return Arr.map(rows, (row) => row.root);
});

describe("vault root key rotation through the registered function", () => {
  it.effect(
    "moves every learner key, then the school key, one page per call, and keeps sealed text readable",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect;
        const moved = yield* t.run(
          Effect.gen(function* () {
            const learners = [
              yield* learnerUnder("ani", retired),
              yield* learnerUnder("budi", retired),
              yield* learnerUnder("citra", current),
            ];
            const harapan = yield* schoolUnder("harapan", retired);
            expect(yield* roots()).toEqual(["old", "old", "test"]);
            expect(yield* rewrapKeys(1)).toBe(1);
            expect(yield* roots()).toEqual(["test", "old", "test"]);
            return { learners, school: harapan };
          }).pipe(Effect.orDie),
          Moved
        );
        expect(yield* t.mutation(refs.internal.vault.keys.rewrap, {})).toBe(1);
        expect(yield* t.mutation(refs.internal.vault.keys.rewrap, {})).toBe(1);
        expect(yield* t.mutation(refs.internal.vault.keys.rewrap, {})).toBe(0);
        yield* t.run(
          Effect.gen(function* () {
            expect(yield* roots()).toEqual(["test", "test", "test"]);
            expect(yield* schoolRoots()).toEqual(["test"]);
            for (const { sealed, userId } of moved.learners) {
              const keys = yield* readLearnerKeys(userId).pipe(
                withRoots(current)
              );
              const user = yield* (yield* DatabaseReader)
                .table("users")
                .get(userId);
              expect(yield* openText(keys, memory, sealed)).toBe(user.name);
            }
            const keys = yield* readTenantKeys(moved.school.tenantId).pipe(
              withRoots(current)
            );
            expect(yield* openText(keys, memory, moved.school.sealed)).toBe(
              "harapan"
            );
          }).pipe(Effect.orDie)
        );
      }).pipe(Effect.provide(confectLayer))
  );
});
