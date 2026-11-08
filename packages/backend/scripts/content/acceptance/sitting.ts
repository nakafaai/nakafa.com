import {
  LocalConvex,
  localConvexLayer,
} from "@repo/backend/scripts/content/acceptance/convex";
import {
  SittingFixture,
  writeFixture,
} from "@repo/backend/scripts/content/acceptance/fixture";
import {
  type AcceptanceMode,
  decodeModeArguments,
} from "@repo/backend/scripts/content/acceptance/mode";
import { Effect, Schema } from "effect";

/**
 * What a seeded sitting holds besides its exam: a room of the same exam for the next day
 * (`upcoming`), an essay that the student writes and the teacher grades (`essay`), a last question
 * whose prompt holds every block and mark once (`prose`), or a question of every other template and
 * the essay (`templates`).
 */
export const SittingExtra = Schema.Literals([
  "upcoming",
  "essay",
  "prose",
  "templates",
]);

/**
 * Seeds one proctored sitting of a keyed exam in the running local acceptance backend and answers
 * the exam, the sitting, and its token. The learner with the address gets a student grant in the
 * school's first active unit, and the sitting opens now and closes an hour later. A `crowd` seats
 * that many extra students with attempts in progress, so a test reads a dashboard of more than one
 * page. Each call seeds a new exam and sitting; `extra` adds what `SittingExtra` names.
 */
export const seedSitting = Effect.fn("contentAcceptance.seedSitting")(
  function* (
    slug: string,
    email: string,
    crowd?: number,
    extra?: typeof SittingExtra.Type
  ) {
    const { run } = yield* LocalConvex;
    return yield* run("sitting seed", {
      args: {
        email,
        slug,
        ...(crowd === undefined ? {} : { crowd }),
        ...(extra === undefined ? {} : { [extra]: true }),
      },
      path: "exams/seed:sitting",
    }).pipe(Effect.flatMap(Schema.decodeUnknownEffect(SittingFixture)));
  }
);

/** The usage of the sitting mode: the school, the learner, the file for the sitting, then the optional crowd and extra. */
const USAGE =
  "sitting <school-slug> <learner-email> <sitting-file> [crowd] [upcoming|essay|prose|templates]";
const SittingArguments = Schema.Tuple([
  Schema.String,
  Schema.String,
  Schema.String,
  Schema.optionalKey(Schema.FiniteFromString),
  Schema.optionalKey(SittingExtra),
]);

/**
 * The sitting mode of the acceptance command line: seeds one proctored sitting for
 * the learner that the command names, with the optional number of extra students,
 * the optional upcoming room, essay, prose question or every template, and writes
 * the sitting to the file that the command names.
 */
export const sittingMode = {
  mode: "sitting",
  usage: USAGE,
  run: Effect.fn("contentAcceptance.runSitting")(function* (
    root: string,
    args: readonly string[]
  ) {
    const [slug, email, output, crowd, extra] = yield* decodeModeArguments(
      USAGE,
      SittingArguments,
      args
    );
    const sitting = yield* seedSitting(slug, email, crowd, extra).pipe(
      Effect.provide(localConvexLayer(root))
    );
    yield* writeFixture(output, SittingFixture, sitting);
  }),
} satisfies AcceptanceMode;
