import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { GuardianFixture } from "@repo/backend/scripts/content/acceptance/fixture";
import { Effect, FileSystem, Schema } from "effect";
import { runAcceptanceCommand } from "@/e2e/support/acceptance";

/**
 * Seeds a parent's sign-in in the running local acceptance runtime, for an address that the
 * school's Admin linked: the linked students' NISN on the roster, and a live code that replaces
 * the one the mail carried. It reads the plain code back, so a test signs the parent in.
 */
export const seedGuardianCode = Effect.fn("NakafaE2E.seedGuardianCode")(
  function* (slug: string, email: string, nisn: string) {
    const fs = yield* FileSystem.FileSystem;
    const directory = yield* fs.makeTempDirectoryScoped({
      prefix: "nakafa-guardian-",
    });
    const output = `${directory}/code.json`;
    yield* runAcceptanceCommand("guardian", slug, email, nisn, output);
    return yield* fs
      .readFileString(output)
      .pipe(Effect.flatMap(Schema.decodeEffect(GuardianFixture)));
  },
  Effect.scoped,
  Effect.provide(nodeServicesLayer)
);
