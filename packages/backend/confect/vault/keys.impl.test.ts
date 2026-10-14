import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import refs from "@repo/backend/confect/_generated/refs";
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
import { Sealed } from "@repo/backend/confect/vault/schema";
import { openText, sealText } from "@repo/backend/confect/vault/text";
import { TEST_ROOT_KEYS } from "@repo/backend/test/vault";
import { Array as Arr, ConfigProvider, Effect, Schema } from "effect";

const memory = { field: "text", table: "ninaMemories" };
const slugOf = Schema.decodeSync(TenantSlug);
const Learners = Schema.mutable(
  Schema.Array(Schema.Struct({ sealed: Sealed, userId: Id("users") }))
);
const Moved = Schema.Struct({
  learners: Learners,
  school: Schema.Struct({ sealed: Sealed, tenantId: Id("tenants") }),
});
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

/** Creates one school whose key the given root key wraps, and seals its slug. */
const school = Effect.fn("test.vault.rotation.school")(function* (
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
              yield* learner("ani", retired),
              yield* learner("budi", retired),
              yield* learner("citra", current),
            ];
            const harapan = yield* school("harapan", retired);
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
