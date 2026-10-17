import { createLearnerAccount } from "@repo/backend/scripts/content/acceptance/account";
import { runLocalConvex } from "@repo/backend/scripts/content/acceptance/convex";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import {
  SESSION_LIFETIME,
  writeSessionCookie,
} from "@repo/backend/scripts/content/acceptance/learner";
import { readLocalRuntime } from "@repo/backend/scripts/content/acceptance/local";
import { ownerAddress } from "@repo/backend/scripts/content/acceptance/school";
import { JsonTextSchema } from "@repo/utilities/json";
import { Array as Arr, Effect, Option, Schema } from "effect";

/** The app users of the local runtime, as the Convex CLI prints them. */
const UserRows = Schema.fromJsonString(
  Schema.Array(Schema.Struct({ _id: Schema.String, authId: Schema.String }))
);
/** One Convex function's arguments as the CLI takes them, JSON text. */
const encodeArguments = Schema.encodeEffect(JsonTextSchema);

/**
 * Signs in the first Owner of a school that `createAcceptanceSchool` opened.
 * The new account holds the Owner's address, so the school's invite waits for
 * it. Claiming is a scheduled function that runs after the account exists, and
 * a browser test must not start before the claim is done, so this command runs
 * the claim itself and then writes the session cookie to `output`. The account
 * is then a member of the school.
 */
export const createAcceptanceOwner = Effect.fn("contentAcceptance.createOwner")(
  function* (root: string, slug: string, output: string) {
    const runtime = yield* readLocalRuntime(root);
    if (runtime === undefined) {
      return yield* acceptanceRuntimeError(
        "Run pnpm acceptance:prepare and start acceptance before creating an owner."
      );
    }
    const run = (
      operation: string,
      args: readonly string[],
      sensitiveValues?: readonly string[]
    ) => runLocalConvex(runtime, operation, args, sensitiveValues);
    const account = yield* createLearnerAccount(
      run,
      SESSION_LIFETIME,
      ownerAddress(slug)
    );
    const users = yield* run("app users", [
      "data",
      "users",
      "--format",
      "jsonArray",
      "--limit",
      "1000",
    ]).pipe(Effect.flatMap(Schema.decodeEffect(UserRows)));
    const owner = Arr.findFirst(
      users,
      (user) => user.authId === account.userId
    );
    if (Option.isNone(owner)) {
      return yield* acceptanceRuntimeError(
        "The new Owner account has no app user to claim the school with."
      );
    }
    yield* encodeArguments({ cursor: null, userId: owner.value._id }).pipe(
      Effect.flatMap((args) =>
        run("school claim", ["run", "tenancy/claims:run", args])
      )
    );
    yield* writeSessionCookie(output, account.token);
  }
);
