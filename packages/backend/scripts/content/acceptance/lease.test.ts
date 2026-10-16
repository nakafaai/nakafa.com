import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import { leaseLocalRuntime } from "@repo/backend/scripts/content/acceptance/lease";
import { reserveLocalRuntime } from "@repo/backend/scripts/content/acceptance/local";
import { fixture } from "@repo/backend/test/acceptance";
import { Effect, FileSystem } from "effect";
import { ChildProcess } from "effect/process";

/** Reserves the runtime directory and records `content` as a lease that a run left behind. */
const recordLease = Effect.fn("LeaseTest.recordLease")(function* (
  root: string,
  content: string
) {
  const fs = yield* FileSystem.FileSystem;
  const reserved = yield* reserveLocalRuntime(root);
  const lock = `${reserved.directory}/using`;
  yield* fs.writeFileString(lock, content);
  return lock;
});

/** Takes the lease and returns what the lease file held while this caller owned it. */
const heldLeaseContent = Effect.fn("LeaseTest.heldLeaseContent")(function* (
  root: string,
  lock: string
) {
  const fs = yield* FileSystem.FileSystem;
  return yield* Effect.scoped(
    Effect.gen(function* () {
      yield* leaseLocalRuntime(root);
      return yield* fs.readFileString(lock);
    })
  );
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
      const { fs, root } = yield* fixture;
      const lock = yield* recordLease(root, String(process.pid));
      expect(
        yield* leaseLocalRuntime(root).pipe(Effect.scoped, Effect.flip)
      ).toMatchObject({
        _tag: "AcceptanceRuntimeError",
        message: expect.stringContaining("in use"),
      });
      expect(yield* fs.readFileString(lock)).toBe(String(process.pid));
    }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.live(
    "refuses a lease held by PID 1, which exists even when this user cannot signal it",
    () =>
      Effect.gen(function* () {
        const { fs, root } = yield* fixture;
        const lock = yield* recordLease(root, "1");
        expect(
          yield* leaseLocalRuntime(root).pipe(Effect.scoped, Effect.flip)
        ).toMatchObject({
          _tag: "AcceptanceRuntimeError",
          message: expect.stringContaining("in use"),
        });
        expect(yield* fs.readFileString(lock)).toBe("1");
      }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.live("takes over a lease whose process has exited", () =>
    Effect.gen(function* () {
      const { fs, root } = yield* fixture;
      const pid = yield* exitedProcessId;
      const lock = yield* recordLease(root, String(pid));
      expect(yield* heldLeaseContent(root, lock)).toBe(String(process.pid));
      expect(yield* fs.exists(lock)).toBe(false);
    }).pipe(Effect.provide(nodeServicesLayer))
  );

  for (const content of ["", "garbage", "0", "-1", "1.5", "4294967296"]) {
    it.live(`takes over a lease whose content is "${content}"`, () =>
      Effect.gen(function* () {
        const { fs, root } = yield* fixture;
        const lock = yield* recordLease(root, content);
        expect(yield* heldLeaseContent(root, lock)).toBe(String(process.pid));
        expect(yield* fs.exists(lock)).toBe(false);
      }).pipe(Effect.provide(nodeServicesLayer))
    );
  }
});
