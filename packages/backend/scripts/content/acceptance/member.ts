import { createLearnerAccount } from "@repo/backend/scripts/content/acceptance/account";
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
import { Array as Arr, Effect, Option, Schema } from "effect";

/** The app users of the local runtime, as the Convex CLI prints them. */
const UserRows = Schema.fromJsonString(
  Schema.Array(Schema.Struct({ _id: Schema.String, authId: Schema.String }))
);
/** One Convex function's arguments as the CLI takes them, JSON text. */
export const encodeArguments = Schema.encodeEffect(JsonTextSchema);

/**
 * Signs in the account that holds an address which a school's invite waits for.
 * The new account takes the address, so the invite is claimed for its app user,
 * and the account is then a member of the school. A claim is a scheduled
 * function, so this command runs the claim itself, and then writes the session
 * cookie to `output`. A browser test must not start before the claim is done.
 */
export const signInInvitedMember = Effect.fn("contentAcceptance.signInMember")(
  function* (runtime: LocalRuntime, address: string, output: string) {
    const run = (
      operation: string,
      args: readonly string[],
      sensitiveValues?: readonly string[]
    ) => runLocalConvex(runtime, operation, args, sensitiveValues);
    const account = yield* createLearnerAccount(run, SESSION_LIFETIME, address);
    const users = yield* run("app users", [
      "data",
      "users",
      "--format",
      "jsonArray",
      "--limit",
      "1000",
    ]).pipe(Effect.flatMap(Schema.decodeEffect(UserRows)));
    const member = Arr.findFirst(
      users,
      (user) => user.authId === account.userId
    );
    if (Option.isNone(member)) {
      return yield* acceptanceRuntimeError(
        "The new account has no app user to claim the school with."
      );
    }
    yield* encodeArguments({ cursor: null, userId: member.value._id }).pipe(
      Effect.flatMap((args) =>
        run("school claim", ["run", "tenancy/claims:run", args])
      )
    );
    yield* writeSessionCookie(output, account.token);
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
      `Run pnpm acceptance:prepare and start acceptance before creating a ${member.label}.`
    );
  }
  yield* runLocalConvex(runtime, `${member.label} seed`, [
    "run",
    member.seed,
    member.args,
  ]);
  yield* signInInvitedMember(runtime, member.address, output);
});
