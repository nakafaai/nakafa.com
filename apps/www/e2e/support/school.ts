import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import type { BrowserContext } from "@playwright/test";
import {
  SchoolFixture,
  SessionCookie,
} from "@repo/backend/scripts/content/acceptance/fixture";
import { Effect, FileSystem, Schema } from "effect";
import { runAcceptanceCommand } from "@/e2e/support/acceptance";
import { addSessionCookie } from "@/e2e/support/context";

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
 * Signs in a member of a school that `createSchool` opened, through the acceptance
 * command of its kind (`owner` or `teacher`), and returns its session cookie. The
 * command holds the member's address and claims the school's invite before the
 * cookie is returned, so the member is a member when the cookie is used. Each
 * command runs once per school: a second run would open the same account again.
 */
const createMemberCookie = Effect.fn("NakafaE2E.createMemberCookie")(
  function* (kind: "owner" | "teacher", slug: string) {
    const fs = yield* FileSystem.FileSystem;
    const directory = yield* fs.makeTempDirectoryScoped({
      prefix: `nakafa-${kind}-`,
    });
    const output = `${directory}/cookie.json`;
    yield* runAcceptanceCommand(kind, slug, output);
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
  const cookie = yield* createMemberCookie("owner", slug);
  yield* addSessionCookie(context, cookie, address);
});

/**
 * Signs the Teacher of a school into one browser context, for the school host at
 * `address`. A Teacher is a member without the school's management rights, so the
 * school settings answer not found for it.
 */
export const signInTeacher = Effect.fn("NakafaE2E.signInTeacher")(function* (
  context: BrowserContext,
  slug: string,
  address: string
) {
  const cookie = yield* createMemberCookie("teacher", slug);
  yield* addSessionCookie(context, cookie, address);
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
