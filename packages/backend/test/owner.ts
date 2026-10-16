import {
  type DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { NEW_TENANT_POLICIES } from "@repo/backend/confect/tenancy/policy";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import {
  createTenantKey,
  ensureLearnerKeys,
  readTenantKeys,
} from "@repo/backend/confect/vault/keys";
import { sealText } from "@repo/backend/confect/vault/text";
import { slugOf } from "@repo/backend/test/tenancy";
import { withRoots } from "@repo/backend/test/vault";
import { Effect } from "effect";

/** The text that the fixtures and the vault tests seal and open. */
export const fact = "Lebih suka contoh soal dulu, baru rumusnya.";
/** The field that the fixtures seal a name or a slug in, and that the tests open it in. */
export const memory = { field: "text", table: "ninaMemories" };

/** Creates one account with no key yet and returns its id. */
export const learner = Effect.fn("test.vault.owner.learner")(function* (
  name: string
) {
  return yield* (yield* DatabaseWriter).table("users").insert({
    authId: `vault-${name}`,
    credits: 0,
    creditsResetAt: 0,
    email: `${name}@example.com`,
    name,
    plan: "free",
  });
});

/** Creates one school with no key yet and returns its id. */
export const school = Effect.fn("test.vault.owner.school")(function* (
  slug: string
) {
  return yield* (yield* DatabaseWriter).table("tenants").insert({
    country: "ID",
    currency: "IDR",
    kind: "school",
    name: `Sekolah ${slug}`,
    policies: NEW_TENANT_POLICIES,
    slug: slugOf(slug),
    status: "active",
  });
});

/** Runs one scenario inside a mutation of a fresh deployment. */
export const scenario = <A, Failure>(
  body: Effect.Effect<A, Failure, DatabaseReader | DatabaseWriter>
) =>
  Effect.gen(function* () {
    yield* (yield* Confect).run(body.pipe(Effect.orDie));
  }).pipe(Effect.provide(confectLayer));

/**
 * Creates one account whose key the given root keys wrap, and seals its name
 * with that key.
 */
export const learnerUnder = Effect.fn("test.vault.owner.learnerUnder")(
  function* (name: string, roots: string) {
    const userId = yield* learner(name);
    const keys = yield* ensureLearnerKeys(userId).pipe(withRoots(roots));
    return { sealed: yield* sealText(keys, memory, name), userId };
  }
);

/**
 * Creates one school whose key the given root keys wrap, and seals its slug with
 * that key.
 */
export const schoolUnder = Effect.fn("test.vault.owner.schoolUnder")(function* (
  slug: string,
  roots: string
) {
  const tenantId = yield* school(slug);
  yield* createTenantKey(tenantId).pipe(withRoots(roots));
  const keys = yield* readTenantKeys(tenantId).pipe(withRoots(roots));
  return { sealed: yield* sealText(keys, memory, slug), tenantId };
});
