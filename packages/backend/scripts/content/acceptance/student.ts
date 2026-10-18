import { runLocalConvex } from "@repo/backend/scripts/content/acceptance/convex";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import { readLocalRuntime } from "@repo/backend/scripts/content/acceptance/local";
import { encodeArguments } from "@repo/backend/scripts/content/acceptance/member";
import { Effect } from "effect";

/**
 * Gives the learner who holds the address a student grant in the school's first active unit,
 * in the running local acceptance backend, so a browser test can place the learner in a cohort.
 * The learner must already be a member of the school, as `invite` makes it, because the grant
 * is written for the member of that address.
 */
export const createAcceptanceStudent = Effect.fn(
  "contentAcceptance.createStudent"
)(function* (root: string, slug: string, email: string) {
  const runtime = yield* readLocalRuntime(root);
  if (runtime === undefined) {
    return yield* acceptanceRuntimeError(
      "Run pnpm acceptance:prepare and start acceptance before granting a student."
    );
  }
  const args = yield* encodeArguments({ email, slug });
  yield* runLocalConvex(runtime, "student seed", [
    "run",
    "tenancy/seed:student",
    args,
  ]);
});
