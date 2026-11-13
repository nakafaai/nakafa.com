import type { BrowserContext } from "@playwright/test";
import { seedGuardian } from "@repo/backend/scripts/content/acceptance/guardian";
import { Effect } from "effect";
import { runFixture } from "@/e2e/support/acceptance";
import { addSessionCookies } from "@/e2e/support/context";

/**
 * Signs a parent in, in the running local acceptance runtime, for an address that the
 * school's Admin linked: the linked students' NISN on the roster, and the account of the
 * address, which claims its guardian Persons as a Google sign-in does. No test can sign in
 * with Google, so the runtime signs the account in with its password and the context gets
 * the session's cookies for the school's host.
 */
export const signInGuardian = Effect.fn("NakafaE2E.signInGuardian")(function* (
  context: BrowserContext,
  school: { readonly address: string; readonly slug: string },
  email: string,
  nisn: string
) {
  const cookies = yield* runFixture(seedGuardian(school.slug, email, nisn));
  yield* addSessionCookies(context, cookies, school.address);
});
