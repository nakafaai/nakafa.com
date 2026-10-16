import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import type { BrowserContext } from "@playwright/test";
import {
  SchoolFixture,
  SessionCookie,
} from "@repo/backend/scripts/content/acceptance/fixture";
import { Effect, FileSystem, Schema } from "effect";
import { runAcceptanceCommand } from "@/e2e/support/acceptance";

/**
 * Opens a new school in the running local acceptance runtime and reads its
 * address and name back. No account holds the school's Owner address yet, so
 * the school has no member until `signInOwner` signs its Owner in. Opening can
 * time out under a busy machine, the same way a learner can (see
 * `signInLearner`), and a school that a failed run left behind is harmless
 * because every run opens a new one.
 */
export const createSchool = Effect.fn("NakafaE2E.createSchool")(
  function* () {
    const fs = yield* FileSystem.FileSystem;
    const directory = yield* fs.makeTempDirectoryScoped({
      prefix: "nakafa-school-",
    });
    const output = `${directory}/school.json`;
    yield* runAcceptanceCommand("school", output).pipe(
      Effect.retry({ times: 2 })
    );
    return yield* fs
      .readFileString(output)
      .pipe(Effect.flatMap(Schema.decodeEffect(SchoolFixture)));
  },
  Effect.scoped,
  Effect.provide(nodeServicesLayer)
);

/**
 * Signs in the first Owner of a school that `createSchool` opened, and returns
 * its session cookie. The Owner's account holds the school's Owner address, so
 * the school's invite is claimed before the cookie is returned, and the Owner
 * is a member. The command runs once: a second run would try to open the same
 * Owner account again.
 */
const createOwnerCookie = Effect.fn("NakafaE2E.createOwnerCookie")(
  function* (slug: string) {
    const fs = yield* FileSystem.FileSystem;
    const directory = yield* fs.makeTempDirectoryScoped({
      prefix: "nakafa-owner-",
    });
    const output = `${directory}/cookie.json`;
    yield* runAcceptanceCommand("owner", slug, output);
    return yield* fs
      .readFileString(output)
      .pipe(Effect.flatMap(Schema.decodeEffect(SessionCookie)));
  },
  Effect.scoped,
  Effect.provide(nodeServicesLayer)
);

/** Signs the Owner of a school into one browser context, for the school host at `address`. */
export const signInOwner = Effect.fn("NakafaE2E.signInOwner")(function* (
  context: BrowserContext,
  slug: string,
  address: string
) {
  const cookie = yield* createOwnerCookie(slug);
  yield* Effect.promise(() =>
    context.addCookies([
      {
        httpOnly: true,
        name: cookie.name,
        sameSite: "Lax",
        url: address,
        value: cookie.value,
      },
    ])
  );
});

/** The address of a path on a host under the same server as the test's base address. */
export function hostAddress(
  baseURL: string | undefined,
  hostname: string,
  path: string
) {
  const address = new URL(path, String(baseURL));
  address.hostname = hostname;
  return address.href;
}
