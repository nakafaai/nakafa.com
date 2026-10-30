import { runLocalConvex } from "@repo/backend/scripts/content/acceptance/convex";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import { SchoolFixture } from "@repo/backend/scripts/content/acceptance/fixture";
import {
  type LocalRuntime,
  leaseReservedLocalRuntime,
} from "@repo/backend/scripts/content/acceptance/local";
import { decodeModeArguments } from "@repo/backend/scripts/content/acceptance/mode";
import { createAcceptanceOwner } from "@repo/backend/scripts/content/acceptance/owner";
import {
  PRODUCTION_CONCURRENCY,
  withLocalBackend,
} from "@repo/backend/scripts/content/acceptance/process";
import { createAcceptanceSchool } from "@repo/backend/scripts/content/acceptance/school";
import { captureLogs } from "@repo/backend/scripts/load/logs";
import { BLUEPRINT_PLAN, LoadPlan } from "@repo/backend/scripts/load/plan";
import { recorderLayer } from "@repo/backend/scripts/load/recorder";
import { runLoad } from "@repo/backend/scripts/load/run";
import { issueToken, sessionCookie } from "@repo/backend/scripts/load/token";
import { openWire } from "@repo/backend/scripts/load/wire";
import { Duration, Effect, FileSystem, Option, Schedule, Schema } from "effect";

/** The usage of the load test: the report file, then the optional number of students and minutes of the paper. */
const USAGE = "load <report-file> [students] [minutes]";
const LoadArguments = Schema.Tuple([
  Schema.String,
  Schema.optionalKey(Schema.FiniteFromString),
  Schema.optionalKey(Schema.FiniteFromString),
]);

/** A token request that the busy local backend refused is asked again a few times, as a browser would. */
const TOKEN_RETRY = {
  schedule: Schedule.exponential(Duration.millis(200)),
  times: 5,
};

/**
 * Opens one browser's connection to the runtime for a seat's session token. Convex asks for
 * its token through the Convex site's token route with the session's signed cookie, as the
 * app's own token request does, and asks again before each token expires.
 */
const connectTo = (runtime: LocalRuntime) => (sessionToken: string) =>
  openWire(
    runtime.query,
    sessionCookie(sessionToken).pipe(
      Effect.flatMap((cookie) => issueToken(runtime.site, cookie)),
      Effect.retry(TOKEN_RETRY),
      Effect.orDie
    )
  );

/**
 * Opens the school of a load test, as a browser test opens one: a new school, and its Owner
 * signed in, who authors the load test's exam. Its files stay in `directory`, and it returns
 * the school's slug.
 */
const openSchool = Effect.fn("load.command.school")(function* (
  root: string,
  directory: string
) {
  const path = `${directory}/school.json`;
  yield* createAcceptanceSchool(root, path);
  const school = yield* (yield* FileSystem.FileSystem)
    .readFileString(path)
    .pipe(Effect.flatMap(Schema.decodeEffect(SchoolFixture)));
  yield* createAcceptanceOwner(root, school.slug, `${directory}/owner.json`);
  return school.slug;
});

/**
 * Runs the blueprint's load test (K26) against the prepared local acceptance backend, which it
 * starts and stops itself with production's concurrency, and writes the report to the file that
 * the command names, with its Markdown table beside it. A smaller number of students or another pace makes a shorter run of
 * the same shape.
 */
export const runLoadCommand = Effect.fn("load.command")(function* (
  root: string,
  args: readonly string[]
) {
  const [output, students, minutes] = yield* decodeModeArguments(
    USAGE,
    LoadArguments,
    args
  );
  const plan = yield* Schema.decodeEffect(LoadPlan)({
    ...BLUEPRINT_PLAN,
    ...(students === undefined ? {} : { students }),
    ...(minutes === undefined ? {} : { minutes }),
  });
  const reserved = yield* leaseReservedLocalRuntime(root);
  if (Option.isNone(reserved)) {
    return yield* acceptanceRuntimeError(
      "Run bun run acceptance:prepare before a load test."
    );
  }
  const runtime = reserved.value;
  return yield* withLocalBackend(
    runtime,
    runLoad({
      capture: (path) => captureLogs(runtime, path),
      connect: connectTo(runtime),
      output,
      plan,
      run: (operation, commandArgs, sensitiveValues) =>
        runLocalConvex(runtime, operation, commandArgs, sensitiveValues),
      school: (directory) => openSchool(root, directory),
    }).pipe(Effect.provide(recorderLayer)),
    PRODUCTION_CONCURRENCY
  );
}, Effect.scoped);
