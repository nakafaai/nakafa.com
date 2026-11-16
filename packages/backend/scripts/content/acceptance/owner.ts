import { localConvexLayer } from "@repo/backend/scripts/content/acceptance/convex";
import {
  SessionCookies,
  writeFixture,
} from "@repo/backend/scripts/content/acceptance/fixture";
import { seedInvitedMember } from "@repo/backend/scripts/content/acceptance/member";
import {
  type AcceptanceMode,
  decodeModeArguments,
} from "@repo/backend/scripts/content/acceptance/mode";
import { ownerAddress } from "@repo/backend/scripts/content/acceptance/school";
import { Effect, Schema } from "effect";

/**
 * Signs in the first Owner of a school that `seedSchool` opened and answers its
 * session cookie. The new account holds the Owner's address, so the school's
 * invite waits for it, and the account is then a member of the school.
 */
export const seedOwner = Effect.fn("contentAcceptance.seedOwner")(function* (
  slug: string
) {
  return yield* seedInvitedMember(ownerAddress(slug));
});

/** The usage of the owner mode: the school of the Owner, then the file for the session cookie. */
const USAGE = "owner <school-slug> <cookie-file>";
const OwnerArguments = Schema.Tuple([Schema.String, Schema.String]);

/**
 * The owner mode of the acceptance command line: signs in the Owner of the school
 * that the command names, and writes its session cookie to the file it names.
 */
export const ownerMode = {
  mode: "owner",
  usage: USAGE,
  run: Effect.fn("contentAcceptance.runOwner")(function* (
    root: string,
    args: readonly string[]
  ) {
    const [slug, output] = yield* decodeModeArguments(
      USAGE,
      OwnerArguments,
      args
    );
    const cookie = yield* seedOwner(slug).pipe(
      Effect.provide(localConvexLayer(root))
    );
    yield* writeFixture(output, SessionCookies, cookie);
  }),
} satisfies AcceptanceMode;
