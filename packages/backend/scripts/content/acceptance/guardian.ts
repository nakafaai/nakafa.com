import {
  LocalConvex,
  localConvexLayer,
} from "@repo/backend/scripts/content/acceptance/convex";
import { signInAccount } from "@repo/backend/scripts/content/acceptance/account";
import {
  SessionCookies,
  writeFixture,
} from "@repo/backend/scripts/content/acceptance/fixture";
import {
  type AcceptanceMode,
  decodeModeArguments,
} from "@repo/backend/scripts/content/acceptance/mode";
import { Effect, Schema } from "effect";

/** What the guardian seed answers: the account of the address and the password it signs in with. */
const SeededGuardian = Schema.Struct({
  password: Schema.String,
  userId: Schema.String,
});

/**
 * Seeds a parent's sign-in in the running local acceptance backend and answers the parent's
 * session cookies: the NISN of each student that the address is linked to, and the account of
 * the address, which claims its guardian Persons as a Google sign-in does and signs in with its
 * password, since no test can sign in with Google.
 */
export const seedGuardian = Effect.fn("contentAcceptance.seedGuardian")(
  function* (slug: string, email: string, nisn: string) {
    const { run } = yield* LocalConvex;
    const seeded = yield* run("guardian seed", {
      args: { email, nisn, slug },
      path: "guardians/seed:account",
    }).pipe(Effect.flatMap(Schema.decodeUnknownEffect(SeededGuardian)));
    const account = yield* signInAccount(run, seeded);
    return account.cookies;
  }
);

/** The usage of the guardian mode: the school, the linked address, the NISN, and the file for the cookies. */
const USAGE = "guardian <school-slug> <email> <nisn> <cookie-file>";
const GuardianArguments = Schema.Tuple([
  Schema.String,
  Schema.String,
  Schema.String,
  Schema.String,
]);

/**
 * The guardian mode of the acceptance command line: seeds a parent's sign-in for an address
 * that the school linked, and writes the parent's session cookies to the file that the command
 * names.
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
    yield* writeFixture(output, SessionCookies, guardian);
  }),
} satisfies AcceptanceMode;
