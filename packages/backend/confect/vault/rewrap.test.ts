import { describe, expect, it } from "@effect/vitest";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import {
  readLearnerKeys,
  readTenantKeys,
} from "@repo/backend/confect/vault/keys";
import { rewrapKeys } from "@repo/backend/confect/vault/rewrap";
import { openText } from "@repo/backend/confect/vault/text";
import { learnerUnder, memory, schoolUnder } from "@repo/backend/test/owner";
import { TEST_ROOT_KEYS, withRoots } from "@repo/backend/test/vault";
import { Array as Arr, Effect } from "effect";
import { Base64 } from "effect/encoding";

const { current, retired } = TEST_ROOT_KEYS;
const former = `former:${Base64.encode(new Uint8Array(32).fill(5))}`;
/** A root key the environment does not hold, whose name sorts above the current one. */
const above = `zed:${Base64.encode(new Uint8Array(32).fill(7))}`;
const bothRetired = `${current},${retired},${former}`;

/** The root key that each stored key names, in creation order, per table. */
const keyRoots = Effect.fn("test.vault.rewrap.roots")(function* () {
  const reader = yield* DatabaseReader;
  const learners = yield* reader
    .table("vaultKeys")
    .index("by_creation_time")
    .collect();
  const schools = yield* reader
    .table("tenantKeys")
    .index("by_creation_time")
    .collect();
  return {
    learners: Arr.map(learners, (row) => row.root),
    schools: Arr.map(schools, (row) => row.root),
  };
});

describe("vault key rewrap", () => {
  it.effect(
    "moves keys from every retired root key and refuses to report zero while a key names an unknown one",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect;
        yield* t.run(
          Effect.gen(function* () {
            yield* learnerUnder("dewi", former);
            yield* learnerUnder("eko", retired);
            expect(yield* rewrapKeys(10)).toBe(1);
            expect((yield* keyRoots()).learners).toEqual(["former", "test"]);
            expect((yield* Effect.flip(rewrapKeys(10))).reason).toBe(
              "configuration"
            );
            expect(yield* rewrapKeys(10).pipe(withRoots(bothRetired))).toBe(1);
            expect(yield* rewrapKeys(10).pipe(withRoots(bothRetired))).toBe(0);
            expect((yield* keyRoots()).learners).toEqual(["test", "test"]);
          }).pipe(Effect.orDie)
        );
      }).pipe(Effect.provide(confectLayer))
  );

  it.effect(
    "moves learner keys, then school keys, one page per call, and reports zero only when both tables use the current root",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect;
        yield* t.run(
          Effect.gen(function* () {
            const ani = yield* learnerUnder("ani", retired);
            const harapan = yield* schoolUnder("harapan", retired);
            expect(yield* rewrapKeys(1)).toBe(1);
            expect(yield* keyRoots()).toEqual({
              learners: ["test"],
              schools: ["old"],
            });
            expect(yield* rewrapKeys(1)).toBe(1);
            expect(yield* rewrapKeys(1)).toBe(0);
            expect(yield* keyRoots()).toEqual({
              learners: ["test"],
              schools: ["test"],
            });
            // The text sealed before the move still opens, with the current root alone.
            const keys = yield* readLearnerKeys(ani.userId).pipe(
              withRoots(current)
            );
            expect(yield* openText(keys, memory, ani.sealed)).toBe("ani");
            const schoolKeys = yield* readTenantKeys(harapan.tenantId).pipe(
              withRoots(current)
            );
            expect(yield* openText(schoolKeys, memory, harapan.sealed)).toBe(
              "harapan"
            );
          }).pipe(Effect.orDie)
        );
      }).pipe(Effect.provide(confectLayer))
  );

  it.effect(
    "refuses to report zero while a school key names an unknown root key, and moves it once the key is in the environment",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect;
        yield* t.run(
          Effect.gen(function* () {
            yield* schoolUnder("baru", former);
            expect((yield* Effect.flip(rewrapKeys(10))).reason).toBe(
              "configuration"
            );
            expect(yield* rewrapKeys(10).pipe(withRoots(bothRetired))).toBe(1);
            expect(yield* rewrapKeys(10).pipe(withRoots(bothRetired))).toBe(0);
            expect((yield* keyRoots()).schools).toEqual(["test"]);
          }).pipe(Effect.orDie)
        );
      }).pipe(Effect.provide(confectLayer))
  );

  it.effect(
    "refuses to report zero while a learner key names a root key above the current one",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect;
        yield* t.run(
          Effect.gen(function* () {
            yield* learnerUnder("fitri", above);
            expect((yield* Effect.flip(rewrapKeys(10))).reason).toBe(
              "configuration"
            );
            expect((yield* keyRoots()).learners).toEqual(["zed"]);
          }).pipe(Effect.orDie)
        );
      }).pipe(Effect.provide(confectLayer))
  );

  it.effect(
    "refuses to report zero while a school key names a root key above the current one",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect;
        yield* t.run(
          Effect.gen(function* () {
            yield* schoolUnder("bahari", above);
            expect((yield* Effect.flip(rewrapKeys(10))).reason).toBe(
              "configuration"
            );
            expect((yield* keyRoots()).schools).toEqual(["zed"]);
          }).pipe(Effect.orDie)
        );
      }).pipe(Effect.provide(confectLayer))
  );
});
