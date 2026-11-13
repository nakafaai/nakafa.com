import { openLearnerAccount } from "@repo/backend/scripts/content/acceptance/account";
import { LocalConvex } from "@repo/backend/scripts/content/acceptance/convex";
import { Effect } from "effect";

/**
 * Signs in the account that holds an address which a school's invite waits for,
 * and answers its session cookies. The first sign-in creates the account with the
 * address, so the invite is claimed for it, and the account is then a member of
 * the school. A later sign-in opens a new session of the same account, so a test
 * may sign the same Owner into several browser contexts. A claim is a scheduled
 * function, so this runs the claim itself: a browser test must not start before
 * the claim is done.
 */
export const seedInvitedMember = Effect.fn("contentAcceptance.invitedMember")(
  function* (address: string) {
    const { run } = yield* LocalConvex;
    const account = yield* openLearnerAccount(run, address);
    yield* run("school claim", {
      args: { cursor: null, userId: account.userId },
      path: "tenancy/claims:run",
    });
    return account.cookies;
  }
);

/**
 * Runs the seed function of one member of an opened school with the seed's own
 * arguments, then signs the account of the member's address in, and answers its
 * session cookies.
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
