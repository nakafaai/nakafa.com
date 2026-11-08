import {
  LocalConvex,
  localConvexLayer,
} from "@repo/backend/scripts/content/acceptance/convex";
import {
  GuardianFixture,
  writeFixture,
} from "@repo/backend/scripts/content/acceptance/fixture";
import {
  type AcceptanceMode,
  decodeModeArguments,
} from "@repo/backend/scripts/content/acceptance/mode";
import { Effect, Schema } from "effect";

/**
 * Seeds a parent's sign-in in the running local acceptance backend and answers the plain code, in
 * place of the mail that would carry it: the NISN of each student that the address is linked to,
 * and a live code for the address.
 */
export const seedGuardian = Effect.fn("contentAcceptance.seedGuardian")(
  function* (slug: string, email: string, nisn: string) {
    const { run } = yield* LocalConvex;
    return yield* run("guardian seed", {
      args: { email, nisn, slug },
      path: "guardians/seed:code",
    }).pipe(Effect.flatMap(Schema.decodeUnknownEffect(GuardianFixture)));
  }
);

/** The usage of the guardian mode: the school, the linked address, the NISN, and the file for the code. */
const USAGE = "guardian <school-slug> <email> <nisn> <code-file>";
const GuardianArguments = Schema.Tuple([
  Schema.String,
  Schema.String,
  Schema.String,
  Schema.String,
]);

/**
 * The guardian mode of the acceptance command line: seeds a parent's sign-in for an address
 * that the school linked, and writes the plain code to the file that the command names.
 */
export const guardianMode = {
  mode: "guardian",
  usage: USAGE,
  run: Effect.fn("contentAcceptance.runGuardian")(function* (
    root: string,
    args: readonly string[]
  ) {
    const [slug, email, nisn, output] = yield* decodeModeArguments(
      USAGE,
      GuardianArguments,
      args
    );
    const guardian = yield* seedGuardian(slug, email, nisn).pipe(
      Effect.provide(localConvexLayer(root))
    );
    yield* writeFixture(output, GuardianFixture, guardian);
  }),
} satisfies AcceptanceMode;
