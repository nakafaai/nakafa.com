import {
  openLearnerAccount,
  type RunConvex,
} from "@repo/backend/scripts/content/acceptance/account";
import { runLocalConvex } from "@repo/backend/scripts/content/acceptance/convex";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import {
  SESSION_LIFETIME,
  writeSessionCookie,
} from "@repo/backend/scripts/content/acceptance/learner";
import {
  type LocalRuntime,
  readLocalRuntime,
} from "@repo/backend/scripts/content/acceptance/local";
import { JsonTextSchema } from "@repo/utilities/json";
import { Effect, Schema } from "effect";

/** The app user id that `tenancy/seed:user` answers, as the Convex CLI prints it. */
const AppUserId = Schema.fromJsonString(Schema.String);
/** One Convex function's arguments as the CLI takes them, JSON text. */
export const encodeArguments = Schema.encodeEffect(JsonTextSchema);

/** The app user of one Better Auth account, read by its index from the local runtime. */
export const appUserOf = Effect.fn("contentAcceptance.appUser")(function* <
  E,
  R,
>(run: RunConvex<E, R>, authId: string) {
  return yield* encodeArguments({ authId }).pipe(
    Effect.flatMap((args) =>
      run("app user", ["run", "tenancy/seed:user", args])
    ),
    Effect.flatMap(Schema.decodeEffect(AppUserId))
  );
});

/**
 * Signs in the account that holds an address which a school's invite waits for,
 * and returns its session token. The first sign-in creates the account with the
 * address, so the invite is claimed for its app user, and the account is then a
 * member of the school. A later sign-in opens a new session of the same account,
 * so a test may sign the same Owner into several browser contexts. A claim is a
 * scheduled function, so this runs the claim itself: a browser test must not
 * start before the claim is done.
 */
export const openInvitedMember = Effect.fn("contentAcceptance.openMember")(
  function* <E, R>(run: RunConvex<E, R>, address: string) {
    const account = yield* openLearnerAccount(run, SESSION_LIFETIME, address);
    const userId = yield* appUserOf(run, account.userId);
    yield* encodeArguments({ cursor: null, userId }).pipe(
      Effect.flatMap((args) =>
        run("school claim", ["run", "tenancy/claims:run", args])
      )
    );
    return account.token;
  }
);

/** Signs in the invited member of `address` and writes its session cookie to `output`. */
export const signInInvitedMember = Effect.fn("contentAcceptance.signInMember")(
  function* (runtime: LocalRuntime, address: string, output: string) {
    const token = yield* openInvitedMember(
      (operation, args, sensitiveValues) =>
        runLocalConvex(runtime, operation, args, sensitiveValues),
      address
    );
    yield* writeSessionCookie(output, token);
  }
);

/**
 * Runs the seed function of one member of an opened school, then signs the account
 * of the member's address in, so its session cookie goes to `output`. The arguments
 * are the seed's own, encoded as the CLI takes them, and no seed runs without a
 * local runtime.
 */
export const seedMember = Effect.fn("contentAcceptance.seedMember")(function* (
  root: string,
  member: {
    readonly address: string;
    readonly args: string;
    readonly label: string;
    readonly seed: string;
  },
  output: string
) {
  const runtime = yield* readLocalRuntime(root);
  if (runtime === undefined) {
    return yield* acceptanceRuntimeError(
      `Run bun run acceptance:prepare and start acceptance before creating a ${member.label}.`
    );
  }
  yield* runLocalConvex(runtime, `${member.label} seed`, [
    "run",
    member.seed,
    member.args,
  ]);
  yield* signInInvitedMember(runtime, member.address, output);
});
