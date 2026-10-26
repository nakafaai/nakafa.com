import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import type { RunConvex } from "@repo/backend/scripts/content/acceptance/account";
import type { LocalRuntime } from "@repo/backend/scripts/content/acceptance/local";
import { audit, StoredAnswer } from "@repo/backend/scripts/load/ledger";
import { serverSamples } from "@repo/backend/scripts/load/logs";
import { type LoadPlan, scriptOf } from "@repo/backend/scripts/load/plan";
import { runProctor } from "@repo/backend/scripts/load/proctor";
import { Recorder, timed } from "@repo/backend/scripts/load/recorder";
import {
  LoadReport,
  markdownOf,
  passes,
} from "@repo/backend/scripts/load/report";
import { seedRun } from "@repo/backend/scripts/load/seed";
import { latencyByName } from "@repo/backend/scripts/load/stats";
import { runStudent } from "@repo/backend/scripts/load/student";
import { issueToken, sessionCookie } from "@repo/backend/scripts/load/token";
import { openWire } from "@repo/backend/scripts/load/wire";
import {
  Array as Arr,
  Clock,
  Deferred,
  Duration,
  Effect,
  Fiber,
  FileSystem,
  HashSet,
  Schedule,
  Schema,
  type Scope,
} from "effect";

/** How long before the first entry the run starts, so every fiber is ready when it does. */
const LEAD = Duration.seconds(5);

/** How long the log stream gets after the last student to print the last executions. */
const LOG_SETTLE = Duration.seconds(5);

/**
 * How often the run checks its own event loop. Every client of the run shares one thread, so a
 * sleep that wakes late shows the driver itself delayed what the client timings read.
 */
const LAG_PROBE = Duration.seconds(1);

/** The most answer rows the audit reads: every answer of the largest run the plan allows, and more. */
const STORED_LIMIT = "1000000";

/** A token request that the busy local backend refused is asked again a few times, as a browser would. */
const TOKEN_RETRY = {
  schedule: Schedule.exponential(Duration.millis(200)),
  times: 5,
};

/**
 * What a run needs from the acceptance runtime: the runtime, the Convex CLI that reaches it,
 * `school`, which opens a school with its Owner signed in, keeping its files in the directory
 * it is given, and returns the school's slug, and `capture`, which streams the function log
 * into a file for the scope.
 */
export interface LoadInput<E> {
  readonly capture: (path: string) => Effect.Effect<void, E, Scope.Scope>;
  readonly output: string;
  readonly plan: LoadPlan;
  readonly run: RunConvex<E, never>;
  readonly runtime: Pick<LocalRuntime, "query" | "site">;
  readonly school: (directory: string) => Effect.Effect<string, E>;
}

/** Opens one browser's connection for a session token: its signed cookie asks for every Convex token. */
const openerFor = (runtime: Pick<LocalRuntime, "query" | "site">) =>
  Effect.fn("load.run.opener")(function* (token: string) {
    const cookie = yield* sessionCookie(token);
    return openWire(
      runtime.query,
      issueToken(runtime.site, cookie).pipe(
        Effect.retry(TOKEN_RETRY),
        Effect.orDie
      )
    );
  });

/**
 * Runs one load test against the running local backend (K26): seeds a school with its exam, its
 * rooms, its students and its proctors; runs every student's script and every proctor at once
 * while the backend's function log streams to a file; then audits the stored answers against
 * every acknowledgement and writes the report as JSON beside its Markdown table.
 */
export const runLoad = Effect.fn("load.run")(function* <E>(
  input: LoadInput<E>
) {
  const fs = yield* FileSystem.FileSystem;
  const recorder = yield* Recorder;
  const directory = yield* fs.makeTempDirectoryScoped({
    prefix: "nakafa-load-",
  });
  const slug = yield* Schema.decodeEffect(TenantSlug)(
    yield* input.school(directory)
  );
  const seeded = yield* seedRun(input.run, input.plan, slug);
  const scripts = yield* Effect.forEach(
    Arr.makeBy(input.plan.students, (index) => index),
    (index) => scriptOf(input.plan, index)
  );
  const open = openerFor(input.runtime);
  const roomOf = (index: number) =>
    Effect.fromOption(Arr.get(seeded.rooms, index)).pipe(Effect.orDie);
  const logPath = `${directory}/functions.jsonl`;
  yield* input.capture(logPath);
  yield* Effect.gen(function* () {
    const before = yield* Clock.currentTimeMillis;
    yield* Effect.sleep(LAG_PROBE);
    const after = yield* Clock.currentTimeMillis;
    yield* recorder.sample({
      failed: false,
      ms: after - before - Duration.toMillis(LAG_PROBE),
      name: "driver:lag",
    });
  }).pipe(Effect.forever, Effect.forkScoped);
  const done = yield* Deferred.make<void>();
  const start = (yield* Clock.currentTimeMillis) + Duration.toMillis(LEAD);
  const proctors = yield* Effect.forkScoped(
    Effect.forEach(
      seeded.proctors,
      Effect.fn(function* (proctor) {
        const room = yield* roomOf(proctor.room);
        return yield* runProctor({
          done,
          open: yield* open(proctor.token),
          seating: { sittingId: room.id, slug },
        });
      }),
      { concurrency: "unbounded" }
    )
  );
  yield* Effect.forEach(
    Arr.zip(scripts, seeded.students),
    Effect.fn(function* ([script, student]) {
      const room = yield* roomOf(student.room);
      yield* timed(
        "run:student",
        runStudent({
          open: yield* open(student.token),
          script,
          seating: { sittingId: room.id, slug, token: room.token },
          start,
        })
      ).pipe(Effect.result);
    }),
    { concurrency: "unbounded", discard: true }
  );
  yield* Deferred.succeed(done, undefined);
  yield* Fiber.join(proctors);
  const endedAt = yield* Clock.currentTimeMillis;
  yield* Effect.sleep(LOG_SETTLE);
  const acknowledged = yield* recorder.acknowledged;
  const attempts = HashSet.fromIterable(
    Arr.map(acknowledged, (answer) => answer.attempt)
  );
  const stored = yield* input
    .run("Stored answers", [
      "data",
      "examAnswers",
      "--format",
      "jsonArray",
      "--limit",
      STORED_LIMIT,
    ])
    .pipe(
      Effect.flatMap(
        Schema.decodeEffect(Schema.fromJsonString(Schema.Array(StoredAnswer)))
      )
    );
  const checked = audit(
    acknowledged,
    Arr.filter(stored, (row) => HashSet.has(attempts, row.attempt))
  );
  const client = latencyByName(yield* recorder.samples);
  const report = LoadReport.make({
    audit: checked,
    client,
    endedAt,
    passed: passes(client, checked),
    plan: input.plan,
    server: latencyByName(serverSamples(yield* fs.readFileString(logPath))),
    startedAt: start,
  });
  yield* fs.writeFileString(
    input.output,
    yield* Schema.encodeEffect(Schema.fromJsonString(LoadReport))(report)
  );
  yield* fs.writeFileString(`${input.output}.md`, markdownOf(report));
  return report;
}, Effect.scoped);
