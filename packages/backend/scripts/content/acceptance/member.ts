import { openLearnerAccount } from "@repo/backend/scripts/content/acceptance/account";
import {
  LocalConvex,
  type RunConvex,
} from "@repo/backend/scripts/content/acceptance/convex";
import {
  SESSION_LIFETIME,
  sessionCookieOf,
} from "@repo/backend/scripts/content/acceptance/learner";
import { Effect, Schema } from "effect";

/** The app user of one Better Auth account, read by its index from the local runtime. */
export const appUserOf = Effect.fn("contentAcceptance.appUser")(function* <
  E,
  R,
>(run: RunConvex<E, R>, authId: string) {
  return yield* run("app user", {
    args: { authId },
    path: "tenancy/seed:user",
  }).pipe(Effect.flatMap(Schema.decodeUnknownEffect(Schema.String)));
});

/**
 * Signs in the account that holds an address which a school's invite waits for,
 * and answers its session cookie. The first sign-in creates the account with the
 * address, so the invite is claimed for its app user, and the account is then a
 * member of the school. A later sign-in opens a new session of the same account,
 * so a test may sign the same Owner into several browser contexts. A claim is a
 * scheduled function, so this runs the claim itself: a browser test must not
 * start before the claim is done.
 */
export const seedInvitedMember = Effect.fn("contentAcceptance.invitedMember")(
  function* (address: string) {
    const { run } = yield* LocalConvex;
    const account = yield* openLearnerAccount(run, SESSION_LIFETIME, address);
    const userId = yield* appUserOf(run, account.userId);
    yield* run("school claim", {
      args: { cursor: null, userId },
      path: "tenancy/claims:run",
    });
    return yield* sessionCookieOf(account.token);
  }
);

/**
 * Runs the seed function of one member of an opened school with the seed's own
 * arguments, then signs the account of the member's address in, and answers its
 * session cookie.
 */
export const seedSchoolMember = Effect.fn("contentAcceptance.schoolMember")(
  function* (member: {
    readonly address: string;
    readonly args: unknown;
    readonly label: string;
    readonly seed: string;
  }) {
    const { run } = yield* LocalConvex;
    yield* run(`${member.label} seed`, {
      args: member.args,
      path: member.seed,
    });
    return yield* seedInvitedMember(member.address);
  }
);
