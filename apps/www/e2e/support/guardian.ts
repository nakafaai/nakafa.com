import { seedGuardian } from "@repo/backend/scripts/content/acceptance/guardian";
import { Effect } from "effect";
import { runFixture } from "@/e2e/support/acceptance";

/**
 * Seeds a parent's sign-in in the running local acceptance runtime, for an address that the
 * school's Admin linked: the linked students' NISN on the roster, and a live code that replaces
 * the one the mail carried. It answers the plain code, so a test signs the parent in.
 */
export const seedGuardianCode = Effect.fn("NakafaE2E.seedGuardianCode")(
  function* (slug: string, email: string, nisn: string) {
    return yield* runFixture(seedGuardian(slug, email, nisn));
  }
);
