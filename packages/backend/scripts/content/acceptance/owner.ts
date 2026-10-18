import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import { readLocalRuntime } from "@repo/backend/scripts/content/acceptance/local";
import { signInInvitedMember } from "@repo/backend/scripts/content/acceptance/member";
import { ownerAddress } from "@repo/backend/scripts/content/acceptance/school";
import { Effect } from "effect";

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
        "Run pnpm acceptance:prepare and start acceptance before creating an owner."
      );
    }
    yield* signInInvitedMember(runtime, ownerAddress(slug), output);
  }
);
