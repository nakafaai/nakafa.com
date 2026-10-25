import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import { readLocalRuntime } from "@repo/backend/scripts/content/acceptance/local";
import { signInInvitedMember } from "@repo/backend/scripts/content/acceptance/member";
import {
  type AcceptanceMode,
  decodeModeArguments,
} from "@repo/backend/scripts/content/acceptance/mode";
import { ownerAddress } from "@repo/backend/scripts/content/acceptance/school";
import { Effect, Schema } from "effect";

/**
 * Signs in the first Owner of a school that `createAcceptanceSchool` opened.
 * The new account holds the Owner's address, so the school's invite waits for
 * it. The account is then a member of the school, and its session cookie goes
 * to `output`.
 */
export const createAcceptanceOwner = Effect.fn("contentAcceptance.createOwner")(
  function* (root: string, slug: string, output: string) {
    const runtime = yield* readLocalRuntime(root);
    if (runtime === undefined) {
      return yield* acceptanceRuntimeError(
        "Run bun run acceptance:prepare and start acceptance before creating an owner."
      );
    }
    yield* signInInvitedMember(runtime, ownerAddress(slug), output);
  }
);

/** The usage of the owner mode: the school of the Owner, then the file for the session cookie. */
const USAGE = "owner <school-slug> <cookie-file>";
const OwnerArguments = Schema.Tuple([Schema.String, Schema.String]);

/**
 * The owner mode of the acceptance command line: signs in the first Owner of the
 * school that the command names, and writes its session cookie to the file that
 * the command names.
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
    return yield* createAcceptanceOwner(root, slug, output);
  }),
} satisfies AcceptanceMode;
