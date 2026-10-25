import { runLocalConvex } from "@repo/backend/scripts/content/acceptance/convex";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import { readLocalRuntime } from "@repo/backend/scripts/content/acceptance/local";
import { encodeArguments } from "@repo/backend/scripts/content/acceptance/member";
import {
  type AcceptanceMode,
  decodeModeArguments,
} from "@repo/backend/scripts/content/acceptance/mode";
import { Effect, Schema } from "effect";

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
      "Run bun run acceptance:prepare and start acceptance before granting a student."
    );
  }
  const args = yield* encodeArguments({ email, slug });
  yield* runLocalConvex(runtime, "student seed", [
    "run",
    "tenancy/seed:student",
    args,
  ]);
});

/** The usage of the student mode: the school, then the learner's address. */
const USAGE = "student <school-slug> <learner-address>";
const StudentArguments = Schema.Tuple([Schema.String, Schema.String]);

/**
 * The student mode of the acceptance command line: gives the learner at the address a
 * student grant in the school that the command names. Arguments after the address are
 * ignored.
 */
export const studentMode = {
  mode: "student",
  usage: USAGE,
  run: Effect.fn("contentAcceptance.runStudent")(function* (
    root: string,
    args: readonly string[]
  ) {
    const [slug, address] = yield* decodeModeArguments(
      USAGE,
      StudentArguments,
      args
    );
    return yield* createAcceptanceStudent(root, slug, address);
  }),
} satisfies AcceptanceMode;
