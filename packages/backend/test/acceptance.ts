import { NodeSocketServer } from "@effect/platform-node";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import { Effect, Fiber, FileSystem, MutableList } from "effect";
import { HttpServer } from "effect/http";
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
