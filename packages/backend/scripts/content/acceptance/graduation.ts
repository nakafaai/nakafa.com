import {
  LocalConvex,
  localConvexLayer,
} from "@repo/backend/scripts/content/acceptance/convex";
import {
  GraduationFixture,
  writeFixture,
} from "@repo/backend/scripts/content/acceptance/fixture";
import {
  type AcceptanceMode,
  decodeModeArguments,
} from "@repo/backend/scripts/content/acceptance/mode";
import { Effect, Schema } from "effect";

/**
 * Seeds a graduation in the running local acceptance backend (ADR 0033, S6) and answers its class
 * group: a class group of the last grade of the school's first active unit with the learner of the
 * address placed in it, a NISN on file, the unit's NPSN, and a locked report card. Each call seeds
 * a new class group.
 */
export const seedGraduation = Effect.fn("contentAcceptance.seedGraduation")(
  function* (slug: string, email: string) {
    const { run } = yield* LocalConvex;
    return yield* run("graduation seed", {
      args: { email, slug },
      path: "records/seed:graduation",
    }).pipe(Effect.flatMap(Schema.decodeUnknownEffect(GraduationFixture)));
  }
);

/** The usage of the graduation mode: the school, the learner, and the file for the class group. */
const USAGE = "graduation <school-slug> <learner-email> <graduation-file>";
const GraduationArguments = Schema.Tuple([
  Schema.String,
  Schema.String,
  Schema.String,
]);

/**
 * The graduation mode of the acceptance command line: seeds one graduating class group for the
 * learner that the command names, and writes it to the file that the command names.
 */
export const graduationMode = {
  mode: "graduation",
  usage: USAGE,
  run: Effect.fn("contentAcceptance.runGraduation")(function* (
    root: string,
    args: readonly string[]
  ) {
    const [slug, email, output] = yield* decodeModeArguments(
      USAGE,
      GraduationArguments,
      args
    );
    const graduation = yield* seedGraduation(slug, email).pipe(
      Effect.provide(localConvexLayer(root))
    );
    yield* writeFixture(output, GraduationFixture, graduation);
  }),
} satisfies AcceptanceMode;
