import { describe, expect, it } from "@effect/vitest";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { NEW_TENANT_POLICIES } from "@repo/backend/confect/tenancy/policy";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import {
  createTenantKey,
  ensureLearnerKeys,
  readLearnerKeys,
  readTenantKeys,
} from "@repo/backend/confect/vault/keys";
import { rewrapKeys } from "@repo/backend/confect/vault/rewrap";
import { openText, sealText } from "@repo/backend/confect/vault/text";
import { TEST_ROOT_KEYS } from "@repo/backend/test/vault";
import { Array as Arr, ConfigProvider, Effect, Schema } from "effect";
import { Base64 } from "effect/encoding";

const memory = { field: "text", table: "ninaMemories" };
const slugOf = Schema.decodeSync(TenantSlug);
const { current, retired } = TEST_ROOT_KEYS;
const former = `former:${Base64.encode(new Uint8Array(32).fill(5))}`;
const bothRetired = `${current},${retired},${former}`;

/** Runs an effect with only the named root keys in the environment. */
const withRoots = (roots: string) =>
  Effect.provide(
    ConfigProvider.layer(ConfigProvider.fromUnknown({ VAULT_ROOT_KEYS: roots }))
  );

/** Creates one account whose key the given root key wraps, and seals its name. */
const learner = Effect.fn("test.vault.rewrap.learner")(function* (
  name: string,
  roots: string
) {
  const userId = yield* (yield* DatabaseWriter).table("users").insert({
    authId: `rewrap-${name}`,
    credits: 0,
    creditsResetAt: 0,
    email: `${name}@example.com`,
    name,
    plan: "free",
  });
  const keys = yield* ensureLearnerKeys(userId).pipe(withRoots(roots));
  return { sealed: yield* sealText(keys, memory, name), userId };
});

/** Creates one school whose key the given root key wraps, and seals its slug. */
const school = Effect.fn("test.vault.rewrap.school")(function* (
  slug: string,
  roots: string
) {
  const tenantId = yield* (yield* DatabaseWriter).table("tenants").insert({
    country: "ID",
    currency: "IDR",
    kind: "school",
    name: `Sekolah ${slug}`,
    policies: NEW_TENANT_POLICIES,
    slug: slugOf(slug),
    status: "active",
  });
  yield* createTenantKey(tenantId).pipe(withRoots(roots));
  const keys = yield* readTenantKeys(tenantId).pipe(withRoots(roots));
  return { sealed: yield* sealText(keys, memory, slug), tenantId };
});

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
            yield* learner("dewi", former);
            yield* learner("eko", retired);
            expect(yield* rewrapKeys(10)).toBe(1);
            expect((yield* keyRoots()).learners).toEqual(["former", "test"]);
            expect((yield* Effect.flip(rewrapKeys(10))).reason).toBe("key");
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
            const ani = yield* learner("ani", retired);
            const harapan = yield* school("harapan", retired);
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
            yield* school("baru", former);
            expect((yield* Effect.flip(rewrapKeys(10))).reason).toBe("key");
            expect(yield* rewrapKeys(10).pipe(withRoots(bothRetired))).toBe(1);
            expect(yield* rewrapKeys(10).pipe(withRoots(bothRetired))).toBe(0);
            expect((yield* keyRoots()).schools).toEqual(["test"]);
          }).pipe(Effect.orDie)
        );
      }).pipe(Effect.provide(confectLayer))
  );
});
