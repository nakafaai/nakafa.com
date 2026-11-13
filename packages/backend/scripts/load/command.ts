import {
  LocalConvex,
  localConvexLayer,
} from "@repo/backend/scripts/content/acceptance/convex";
import {
  type AcceptanceRuntimeError,
  acceptanceRuntimeError,
} from "@repo/backend/scripts/content/acceptance/error";
import {
  type LocalRuntime,
  leaseReservedLocalRuntime,
} from "@repo/backend/scripts/content/acceptance/local";
import { decodeModeArguments } from "@repo/backend/scripts/content/acceptance/mode";
import { seedOwner } from "@repo/backend/scripts/content/acceptance/owner";
import {
  PRODUCTION_CONCURRENCY,
  withLocalBackend,
} from "@repo/backend/scripts/content/acceptance/process";
import { seedSchool } from "@repo/backend/scripts/content/acceptance/school";
import { captureLogs } from "@repo/backend/scripts/load/logs";
import { BLUEPRINT_PLAN, LoadPlan } from "@repo/backend/scripts/load/plan";
import { recorderLayer, timed } from "@repo/backend/scripts/load/recorder";
import { runLoad } from "@repo/backend/scripts/load/run";
import { seatTokens } from "@repo/backend/scripts/load/token";
import { openWire } from "@repo/backend/scripts/load/wire";
import {
  Duration,
  Effect,
  type FileSystem,
  Layer,
  Option,
  type PlatformError,
  Schedule,
  Schema,
} from "effect";
import type { SecureRandom } from "effect/crypto";
import type { ChildProcessSpawner } from "effect/process";

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
 * app's own token request does, and asks again before each token expires. Each request is
 * recorded, and one that the backend still refuses after its retries leaves the tab signed out,
 * so the tab's calls fail and the run goes on to record them.
 */
const connectTo =
  (runtime: LocalRuntime) =>
  (seat: { readonly token: string; readonly userId: string }) =>
    Effect.flatMap(seatTokens(runtime.query, seat), (tokens) =>
      openWire(
        runtime.query,
        timed("auth:token", tokens.pipe(Effect.retry(TOKEN_RETRY))).pipe(
          Effect.orElseSucceed(() => null)
        )
      )
    );

/** How many students sit in one room of the blueprint's plan. */
const ROOM_SIZE = BLUEPRINT_PLAN.students / BLUEPRINT_PLAN.rooms;

/**
 * Opens the school of a load test, as a browser test opens one: a new school, and its Owner
 * signed in, who authors the load test's exam. It returns the school's slug.
 */
const openSchool = Effect.fn("load.command.school")(function* () {
  const school = yield* seedSchool();
  yield* seedOwner(school.slug);
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
  // A smaller run keeps the blueprint's rooms of sixty, so each room has its two proctors.
  const plan = yield* Schema.decodeEffect(LoadPlan)({
    ...BLUEPRINT_PLAN,
    ...(students === undefined
      ? {}
      : { rooms: Math.ceil(students / ROOM_SIZE), students }),
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
    Effect.gen(function* () {
      const convex = yield* LocalConvex;
      return yield* runLoad<
        | AcceptanceRuntimeError
        | PlatformError.PlatformError
        | Schema.SchemaError,
        | ChildProcessSpawner.ChildProcessSpawner
        | FileSystem.FileSystem
        | SecureRandom.SecureRandom
      >({
        capture: (path) => captureLogs(runtime, path),
        connect: connectTo(runtime),
        output,
        plan,
        run: convex.run,
        school: openSchool().pipe(Effect.provideService(LocalConvex, convex)),
      });
    }).pipe(
      Effect.provide(
        Layer.merge(
          recorderLayer(`${output}.acknowledged.jsonl`),
          localConvexLayer(root)
        )
      )
    ),
    PRODUCTION_CONCURRENCY
  );
}, Effect.scoped);
