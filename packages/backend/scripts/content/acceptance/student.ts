import {
  LocalConvex,
  localConvexLayer,
} from "@repo/backend/scripts/content/acceptance/convex";
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
export const seedStudent = Effect.fn("contentAcceptance.seedStudent")(
  function* (slug: string, email: string) {
    const { run } = yield* LocalConvex;
    yield* run("student seed", {
      args: { email, slug },
      path: "tenancy/seed:student",
    });
  }
);

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
    yield* seedStudent(slug, address).pipe(
      Effect.provide(localConvexLayer(root))
    );
  }),
} satisfies AcceptanceMode;
