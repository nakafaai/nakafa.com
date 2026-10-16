import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import {
  leaseLocalRuntime,
  processStart,
} from "@repo/backend/scripts/content/acceptance/lease";
import { reserveLocalRuntime } from "@repo/backend/scripts/content/acceptance/local";
import { fixture, leaseClaims } from "@repo/backend/test/acceptance";
import { randomUuid } from "@repo/utilities/uuid";
import { Array as Arr, Deferred, Effect, Exit, FileSystem, Ref } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

/**
 * Reserves the runtime directory and records a claim of `pid` with `content`, as a
 * run that stopped without releasing its lease would leave it.
 */
const recordClaim = Effect.fn("LeaseTest.recordClaim")(function* (
  root: string,
  pid: string,
  content: string
) {
  const fs = yield* FileSystem.FileSystem;
  const reserved = yield* reserveLocalRuntime(root);
  const claim = `${reserved.directory}/using.${pid}.${yield* randomUuid}`;
  yield* fs.writeFileString(claim, content);
  return claim;
});

/** The ID of a child process that has exited, so no process holds that ID any more. */
const exitedProcessId = Effect.gen(function* () {
  const child = yield* ChildProcess.make(process.execPath, ["--version"], {
    stderr: "ignore",
    stdin: "ignore",
    stdout: "ignore",
  });
  yield* child.exitCode;
  return child.pid;
}).pipe(Effect.scoped);

describe("lease of the owned acceptance runtime", () => {
  it.live("refuses a lease that a live process holds", () =>
    Effect.gen(function* () {
      const { root } = yield* fixture;
      const directory = `${root}/.cache/acceptance`;
      yield* reserveLocalRuntime(root);
      yield* Effect.scoped(
        Effect.gen(function* () {
          yield* leaseLocalRuntime(root);
          expect(
            yield* leaseLocalRuntime(root).pipe(Effect.scoped, Effect.flip)
          ).toMatchObject({
            _tag: "AcceptanceRuntimeError",
            message: expect.stringContaining("in use"),
          });
          expect(yield* leaseClaims(directory)).toHaveLength(1);
        })
      );
      expect(yield* leaseClaims(directory)).toEqual([]);
    }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.live(
    "refuses a claim that a live process holds with the start time it recorded",
    () =>
      Effect.gen(function* () {
        const { fs, root } = yield* fixture;
        const child = yield* ChildProcess.make(
          process.execPath,
          ["-e", "setInterval(() => {}, 1000)"],
          { stderr: "ignore", stdin: "ignore", stdout: "ignore" }
        );
        const claim = yield* recordClaim(
          root,
          String(child.pid),
          yield* processStart(child.pid)
        );
        expect(
          yield* leaseLocalRuntime(root).pipe(Effect.scoped, Effect.flip)
        ).toMatchObject({
          _tag: "AcceptanceRuntimeError",
          message: expect.stringContaining("in use"),
        });
        expect(yield* fs.exists(claim)).toBe(true);
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.live("refuses a claim held by PID 1 with its start time", () =>
    Effect.gen(function* () {
      const { fs, root } = yield* fixture;
      const claim = yield* recordClaim(root, "1", yield* processStart(1));
      expect(
        yield* leaseLocalRuntime(root).pipe(Effect.scoped, Effect.flip)
      ).toMatchObject({
        _tag: "AcceptanceRuntimeError",
        message: expect.stringContaining("in use"),
      });
      expect(yield* fs.exists(claim)).toBe(true);
    }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.live("refuses a claim that a live process is still writing", () =>
    Effect.gen(function* () {
      const { fs, root } = yield* fixture;
      const claim = yield* recordClaim(root, String(process.pid), "");
      expect(
        yield* leaseLocalRuntime(root).pipe(Effect.scoped, Effect.flip)
      ).toMatchObject({
        _tag: "AcceptanceRuntimeError",
        message: expect.stringContaining("in use"),
      });
      expect(yield* fs.exists(claim)).toBe(true);
    }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.live(
    "takes over a claim whose process has exited, and keeps files that are not claims",
    () =>
      Effect.gen(function* () {
        const { fs, root } = yield* fixture;
        const claim = yield* recordClaim(
          root,
          String(yield* exitedProcessId),
          ""
        );
        const manifest = `${root}/.cache/acceptance/manifest.json`;
        yield* fs.writeFileString(manifest, "{}");
        yield* Effect.scoped(leaseLocalRuntime(root));
        expect(yield* fs.exists(claim)).toBe(false);
        expect(yield* fs.readFileString(manifest)).toBe("{}");
        expect(yield* leaseClaims(`${root}/.cache/acceptance`)).toEqual([]);
      }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.live(
    "takes over a claim whose process ID now belongs to another process",
    () =>
      Effect.gen(function* () {
        const { fs, root } = yield* fixture;
        const claim = yield* recordClaim(
          root,
          String(process.pid),
          "a start time that this process did not record"
        );
        yield* Effect.scoped(leaseLocalRuntime(root));
        expect(yield* fs.exists(claim)).toBe(false);
      }).pipe(Effect.provide(nodeServicesLayer))
  );

  for (const pid of [
    "",
    "garbage",
    "0",
    "-1",
    "01",
    "+1",
    "1e0",
    "0x1",
    " 1",
    "2147483648",
  ]) {
    it.live(
      `takes over a claim whose name does not hold a canonical process ID: "${pid}"`,
      () =>
        Effect.gen(function* () {
          const { fs, root } = yield* fixture;
          const claim = yield* recordClaim(root, pid, "");
          yield* Effect.scoped(leaseLocalRuntime(root));
          expect(yield* fs.exists(claim)).toBe(false);
        }).pipe(Effect.provide(nodeServicesLayer))
    );
  }

  it.live(
    "takes over a lease whose holder releases while the start judges it",
    () =>
      Effect.gen(function* () {
        const { fs, root } = yield* fixture;
        const directory = `${root}/.cache/acceptance`;
        yield* reserveLocalRuntime(root);
        // The holder releases its claim just before the start reads it.
        const releasing: FileSystem.FileSystem = {
          ...fs,
          readFileString: (path, encoding) =>
            fs
              .remove(path, { force: true })
              .pipe(Effect.andThen(fs.readFileString(path, encoding))),
        };
        yield* Effect.scoped(
          Effect.gen(function* () {
            yield* leaseLocalRuntime(root);
            yield* leaseLocalRuntime(root).pipe(
              Effect.provideService(FileSystem.FileSystem, releasing)
            );
            expect(yield* leaseClaims(directory)).toHaveLength(1);
          })
        );
      }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.live("refuses both starts that race for one stale claim", () =>
    Effect.gen(function* () {
      const { fs, root } = yield* fixture;
      const stale = yield* recordClaim(
        root,
        String(yield* exitedProcessId),
        ""
      );
      const arrived = yield* Ref.make(0);
      const gate = yield* Deferred.make<void>();
      // Each start pauses at its removal of the stale claim until both have reached
      // it, so both judge the same stale claim before either one acts on the result.
      const racing: FileSystem.FileSystem = {
        ...fs,
        remove: (path, options) =>
          path === stale
            ? Ref.updateAndGet(arrived, (count) => count + 1).pipe(
                Effect.flatMap((count) =>
                  count === 2 ? Deferred.succeed(gate, undefined) : Effect.void
                ),
                Effect.andThen(Deferred.await(gate)),
                Effect.andThen(fs.remove(path, options))
              )
            : fs.remove(path, options),
      };
      const start = leaseLocalRuntime(root).pipe(
        Effect.provideService(FileSystem.FileSystem, racing),
        Effect.exit
      );
      // Both starts share one scope, so a start that succeeds keeps its claim
      // while the other one judges it, as a running operation does.
      const outcomes = yield* Effect.scoped(
        Effect.all([start, start], { concurrency: "unbounded" })
      );
      expect(Arr.filter(outcomes, Exit.isSuccess).length).toBeLessThanOrEqual(
        1
      );
    }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.live(
    "refuses a lease when this process cannot report its own start time",
    () =>
      Effect.gen(function* () {
        const { fs, root } = yield* fixture;
        const reserved = yield* reserveLocalRuntime(root);
        const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
        // Every `ps` exits with status 1, as a `ps` without the lstart column does.
        const withoutStartTimes = ChildProcessSpawner.make((command) =>
          spawner.spawn(
            ChildProcess.isStandardCommand(command) && command.command === "ps"
              ? ChildProcess.make("sh", ["-c", "exit 1"], { stdin: "ignore" })
              : command
          )
        );
        expect(
          yield* leaseLocalRuntime(root).pipe(
            Effect.scoped,
            Effect.provideService(
              ChildProcessSpawner.ChildProcessSpawner,
              withoutStartTimes
            ),
            Effect.flip
          )
        ).toMatchObject({
          _tag: "AcceptanceRuntimeError",
          message: expect.stringContaining("start time"),
        });
        expect(yield* leaseClaims(reserved.directory)).toEqual([]);
        expect(yield* fs.exists(reserved.directory)).toBe(true);
      }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.live(
    "reports a missing runtime directory as its own failure, not as in use",
    () =>
      Effect.gen(function* () {
        const { root } = yield* fixture;
        expect(
          yield* leaseLocalRuntime(root).pipe(Effect.scoped, Effect.flip)
        ).toMatchObject({ _tag: "PlatformError" });
      }).pipe(Effect.provide(nodeServicesLayer))
  );
});
