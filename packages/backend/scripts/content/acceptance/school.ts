import {
  LocalConvex,
  localConvexLayer,
} from "@repo/backend/scripts/content/acceptance/convex";
import {
  SchoolFixture,
  writeFixture,
} from "@repo/backend/scripts/content/acceptance/fixture";
import {
  type AcceptanceMode,
  decodeModeArguments,
} from "@repo/backend/scripts/content/acceptance/mode";
import { Effect, Schema } from "effect";
import { SecureRandom } from "effect/crypto";
import { Hex } from "effect/encoding";

/**
 * The address of the first Owner of a school opened by `seedSchool`. `owner`
 * signs in the account that holds it, so the school and its Owner agree on one
 * address.
 */
export const ownerAddress = (slug: string) =>
  `owner-${slug}@acceptance.example.test`;

/**
 * Opens one school in the running local acceptance backend, the way Nakafa
 * staff open one, and answers its address and name. `tenancy/provision:open`
 * writes the school, its unit, and an invite for its first Owner, whose address
 * matches no account, so the school has no member yet. Each call opens a new
 * school, so every test starts from one that no test has used.
 */
export const seedSchool = Effect.fn("contentAcceptance.seedSchool")(
  function* () {
    const { run } = yield* LocalConvex;
    const crypto = yield* SecureRandom.SecureRandom;
    const id = Hex.encode(yield* crypto.randomBytes(4));
    const school = { name: `Sekolah ${id}`, slug: `acc-${id}` };
    yield* run("school opening", {
      args: {
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
      },
      path: "tenancy/provision:open",
    });
    return school;
  }
);

/** The usage of the school mode, which names the file that the school goes to. */
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
    const school = yield* seedSchool().pipe(
      Effect.provide(localConvexLayer(root))
    );
    yield* writeFixture(output, SchoolFixture, school);
  }),
} satisfies AcceptanceMode;
