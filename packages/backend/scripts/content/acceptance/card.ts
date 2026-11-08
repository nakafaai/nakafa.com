import {
  LocalConvex,
  localConvexLayer,
} from "@repo/backend/scripts/content/acceptance/convex";
import {
  CardFixture,
  writeFixture,
} from "@repo/backend/scripts/content/acceptance/fixture";
import {
  type AcceptanceMode,
  decodeModeArguments,
} from "@repo/backend/scripts/content/acceptance/mode";
import { Effect, Schema } from "effect";

/**
 * Seeds one new student of a school in the running local acceptance backend, with a student grant
 * in the school's first active unit and a login card, and answers the login name and the plain
 * code. Each call seeds a new student.
 */
export const seedCard = Effect.fn("contentAcceptance.seedCard")(function* (
  slug: string
) {
  const { run } = yield* LocalConvex;
  return yield* run("login card seed", {
    args: { slug },
    path: "identity/seed:card",
  }).pipe(Effect.flatMap(Schema.decodeUnknownEffect(CardFixture)));
});

/** The usage of the card mode: the school of the new student, then the file for the login card. */
const USAGE = "card <school-slug> <card-file>";
const CardArguments = Schema.Tuple([Schema.String, Schema.String]);

/**
 * The card mode of the acceptance command line: seeds one new student of the
 * school that the command names, with a login card, and writes the login name and
 * the plain code to the file that the command names.
 */
export const cardMode = {
  mode: "card",
  usage: USAGE,
  run: Effect.fn("contentAcceptance.runCard")(function* (
    root: string,
    args: readonly string[]
  ) {
    const [slug, output] = yield* decodeModeArguments(
      USAGE,
      CardArguments,
      args
    );
    const card = yield* seedCard(slug).pipe(
      Effect.provide(localConvexLayer(root))
    );
    yield* writeFixture(output, CardFixture, card);
  }),
} satisfies AcceptanceMode;
