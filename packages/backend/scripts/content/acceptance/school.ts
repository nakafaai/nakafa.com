import { runLocalConvex } from "@repo/backend/scripts/content/acceptance/convex";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import { SchoolFixture } from "@repo/backend/scripts/content/acceptance/fixture";
import { readLocalRuntime } from "@repo/backend/scripts/content/acceptance/local";
import {
  type AcceptanceMode,
  decodeModeArguments,
} from "@repo/backend/scripts/content/acceptance/mode";
import { JsonTextSchema } from "@repo/utilities/json";
import { Effect, FileSystem, Schema } from "effect";
import { SecureRandom } from "effect/crypto";
import { Hex } from "effect/encoding";

/** One Convex function's arguments as the CLI takes them, JSON text. */
const encodeArguments = Schema.encodeEffect(JsonTextSchema);

/**
 * The address of the first Owner of a school opened by `createAcceptanceSchool`.
 * `owner` signs in the account that holds it, so the school and its Owner
 * agree on one address.
 */
export const ownerAddress = (slug: string) =>
  `owner-${slug}@acceptance.example.test`;

/**
 * Opens one school in the running local acceptance backend, the way Nakafa
 * staff open one: `tenancy/provision:open` writes the school, its unit, and an
 * invite for its first Owner, whose address matches no account, so the school
 * has no member yet. The school's address and name go to `output` for a
 * browser test. Each call opens a new school, so every test starts from one
 * that no test has used.
 */
export const createAcceptanceSchool = Effect.fn(
  "contentAcceptance.createSchool"
)(function* (root: string, output: string) {
  const runtime = yield* readLocalRuntime(root);
  if (runtime === undefined) {
    return yield* acceptanceRuntimeError(
      "Run bun run acceptance:prepare and start acceptance before creating a school."
    );
  }
  const crypto = yield* SecureRandom.SecureRandom;
  const id = Hex.encode(yield* crypto.randomBytes(4));
  const school = { name: `Sekolah ${id}`, slug: `acc-${id}` };
  const args = yield* encodeArguments({
    contract: {
      contentLicense: "1.0",
      dpaVersion: "2026-10",
      modules: ["classes", "exams"],
      plan: "tenant",
    },
    country: "ID",
    currency: "IDR",
    kind: "school",
    name: school.name,
    owner: { email: ownerAddress(school.slug), name: "Acceptance Owner" },
    slug: school.slug,
    units: [
      {
        contentLanguage: "id",
        level: "sma",
        name: `SMA ${school.name}`,
        timeZone: "Asia/Jakarta",
      },
    ],
  });
  yield* runLocalConvex(runtime, "tenancy/provision:open", [
    "run",
    "tenancy/provision:open",
    args,
  ]);
  const fixture = yield* Schema.encodeEffect(SchoolFixture)(school);
  const fs = yield* FileSystem.FileSystem;
  yield* fs.writeFileString(output, fixture, { flag: "wx", mode: 0o600 });
});

/** The usage of the school mode, which names the file that the opened school goes to. */
const USAGE = "school <school-file>";
const SchoolArguments = Schema.Tuple([Schema.String]);

/**
 * The school mode of the acceptance command line: opens one school and writes its
 * address and name to the file that the command names.
 */
export const schoolMode = {
  mode: "school",
  usage: USAGE,
  run: Effect.fn("contentAcceptance.runSchool")(function* (
    root: string,
    args: readonly string[]
  ) {
    const [output] = yield* decodeModeArguments(USAGE, SchoolArguments, args);
    return yield* createAcceptanceSchool(root, output);
  }),
} satisfies AcceptanceMode;
