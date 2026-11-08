import { NodeSocketServer } from "@effect/platform-node";
import {
  ConvexCall,
  LocalConvex,
} from "@repo/backend/scripts/content/acceptance/convex";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import {
  Array as Arr,
  Effect,
  Fiber,
  FileSystem,
  Layer,
  MutableList,
  Option,
  Record as Rec,
  Schema,
  Sink,
  Stream,
} from "effect";
import { HttpServer } from "effect/http";
import { ChildProcessSpawner } from "effect/process";
import { TestClock } from "effect/testing";

/**
 * Holds a loopback port until the scope ends, as a process does that started
 * without the acceptance lease. Port 0 lets the system pick a free one. It
 * returns the port held.
 */
export const occupyPort = Effect.fn("AcceptanceTest.occupyPort")(function* (
  port: number
) {
  const server = yield* NodeSocketServer.make({ host: "127.0.0.1", port });
  return Number(new URL(HttpServer.formatAddress(server.address)).port);
});

/** Whether something holds a loopback port, which a second listener learns by failing to bind it. */
export const isPortOccupied = Effect.fn("AcceptanceTest.isPortOccupied")(
  (port: number) =>
    NodeSocketServer.make({ host: "127.0.0.1", port }).pipe(
      Effect.scoped,
      Effect.isFailure
    )
);

/** A temporary backend checkout holding the Convex files a local runtime reads. */
export const fixture = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const directory = yield* fs.makeTempDirectoryScoped({
    prefix: "acceptance-local-test-",
  });
  const root = yield* fs.realPath(directory);
  yield* fs.makeDirectory(`${root}/packages/backend`, { recursive: true });
  yield* fs.writeFileString(
    `${root}/packages/backend/convex.json`,
    '{"node":{"nodeVersion":"24"}}'
  );
  yield* fs.writeFileString(
    `${root}/packages/backend/.env.local`,
    "CONVEX_DEPLOYMENT=developer-owned"
  );
  yield* fs.makeDirectory(`${root}/packages/backend/.convex`);
  return { fs, root };
});

/** The lease claim files that a runtime directory holds. */
export const leaseClaims = Effect.fn("AcceptanceTest.leaseClaims")(function* (
  directory: string
) {
  const fs = yield* FileSystem.FileSystem;
  return Arr.filter(yield* fs.readDirectory(directory), (name) =>
    name.startsWith("using.")
  );
});

/** The text the Convex CLI prints when version.convex.dev answers with an error status. */
export const versionServiceError = (status: number) =>
  `✖ version.convex.dev returned ${status}: {"code":"InternalServerError"}`;

/**
 * Answers the Convex commands of an anonymous runtime. `init` writes `source` as
 * the environment and a loopback configuration; every command records the
 * temporary root it ran in while that root still exists. The first `init` calls
 * fail with `failures` before they write anything, as the CLI does when its
 * version lookup fails.
 */
export function anonymousConvexCommand(
  source: string,
  temporaryRoots: MutableList.MutableList<string>,
  failures: readonly string[] = []
) {
  const pending = MutableList.make<string>();
  MutableList.appendAll(pending, failures);
  return (spec: {
    args: readonly string[];
    cwd: string;
    env: Readonly<Record<string, string | undefined>>;
  }) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = spec.env.TMPDIR;
      if (root !== undefined && (yield* fs.exists(root))) {
        MutableList.append(temporaryRoots, root);
      }
      if (spec.args[1] !== "init") {
        return;
      }
      const failure = MutableList.take(pending);
      if (typeof failure === "string") {
        return yield* acceptanceRuntimeError(
          `Anonymous Convex init failed: ${failure}`
        );
      }
      yield* fs.writeFileString(`${spec.cwd}/.env.local`, source);
      yield* fs.makeDirectory(`${spec.cwd}/.convex/local/default`, {
        recursive: true,
      });
      yield* fs.writeFileString(
        `${spec.cwd}/.convex/local/default/config.json`,
        '{"ports":{"cloud":43120,"site":43121}}'
      );
    });
}

/**
 * Runs an operation whose retry pauses wait on the TestClock. A pause starts only
 * after the failed attempt's real file operations finish, so the clock moves in
 * small steps until the operation settles, never far past a readiness timeout.
 */
export const ticking = Effect.fn("AcceptanceTest.ticking")(function* <A, E, R>(
  operation: Effect.Effect<A, E, R>
) {
  const ticker = yield* Effect.forkChild(
    Effect.forever(TestClock.adjust("10 millis"))
  );
  return yield* operation.pipe(Effect.ensuring(Fiber.interrupt(ticker)));
});

/**
 * Writes a backend directory's `convex.json` naming Node 24 and a Homebrew-style
 * prefix that holds that Node, as `resolveConvexNodeBin` reads them. It returns
 * the prefix, which `brewPrefixAnswer` gives back for `brew --prefix node@24`.
 */
export const installConvexNode = Effect.fn("AcceptanceTest.installConvexNode")(
  function* (directory: string) {
    const fs = yield* FileSystem.FileSystem;
    yield* fs.writeFileString(
      `${directory}/convex.json`,
      '{"node":{"nodeVersion":"24"}}'
    );
    const prefix = `${directory}/homebrew/node@24`;
    yield* fs.makeDirectory(`${prefix}/bin`, { recursive: true });
    yield* fs.writeFileString(`${prefix}/bin/node`, "");
    return prefix;
  }
);

/** The handle of a `brew --prefix` that prints one prefix and exits with status 0. */
export const brewPrefixAnswer = (prefix: string) =>
  ChildProcessSpawner.makeHandle({
    all: Stream.empty,
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(0)),
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    pid: ChildProcessSpawner.ProcessId(2),
    stderr: Stream.empty,
    stdin: Sink.drain,
    stdout: Stream.succeed(new TextEncoder().encode(`${prefix}\n`)),
    unref: Effect.succeed(Effect.void),
  });

/** One call that the local backend double received. */
const RecordedCall = Schema.Struct({
  call: ConvexCall,
  operation: Schema.String,
  sensitiveValues: Schema.Array(Schema.String),
});

/** One import that the local backend double received. */
const RecordedImport = Schema.Struct({
  rows: Schema.Array(Schema.Unknown),
  table: Schema.String,
});

/**
 * A local backend that answers each function by its path from `answers`, null
 * for a path it does not name, and fails the paths in `failing` as the backend
 * fails a function. It keeps every call and every import in the order they came.
 */
export const localConvexDouble = (
  answers: Readonly<Record<string, unknown>> = {},
  failing: readonly string[] = []
) => {
  const calls = MutableList.make<typeof RecordedCall.Type>();
  const imports = MutableList.make<typeof RecordedImport.Type>();
  const convex = LocalConvex.of({
    importRows: (table, rows) =>
      Effect.sync(() => {
        MutableList.append(imports, { rows, table });
      }),
    run: (operation, call, sensitiveValues = []) =>
      Effect.suspend(() => {
        MutableList.append(calls, { call, operation, sensitiveValues });
        return Arr.contains(failing, call.path)
          ? Effect.fail(acceptanceRuntimeError(`${operation} failed`))
          : Effect.succeed(Option.getOrNull(Rec.get(answers, call.path)));
      }),
  });
  return {
    /** Every call in the order it came. */
    calls: () => MutableList.toArray(calls),
    /** The arguments of the first call of `path`. */
    argsOf: (path: string) =>
      Option.getOrThrow(
        Arr.findFirst(
          MutableList.toArray(calls),
          (one) => one.call.path === path
        )
      ).call.args,
    /** Every import in the order it came. */
    imports: () => MutableList.toArray(imports),
    layer: Layer.succeed(LocalConvex, convex),
    /** The paths of the calls in the order they came. */
    paths: () => Arr.map(MutableList.toArray(calls), (one) => one.call.path),
    run: convex.run,
  };
};
