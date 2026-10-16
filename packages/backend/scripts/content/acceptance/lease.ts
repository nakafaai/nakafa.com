import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import {
  Effect,
  FileSystem,
  Option,
  Schema,
  SchemaTransformation,
} from "effect";

/**
 * A process ID that a lease may record: a positive integer up to 2147483647, the
 * largest signed 32-bit value. Node rejects a larger number before it sends a
 * signal, so a number above it cannot name a process here.
 */
const ProcessId = Schema.Int.check(
  Schema.isGreaterThan(0),
  Schema.isLessThanOrEqualTo(2_147_483_647)
);

/** Signal 0 failed because no process has the ID. */
class NoSuchProcess extends Schema.TaggedError<NoSuchProcess>()(
  "NoSuchProcess",
  { pid: ProcessId }
) {}

/** Signal 0 failed for a process that exists, such as EPERM for one this user may not signal. */
class ProcessExists extends Schema.TaggedError<ProcessExists>()(
  "ProcessExists",
  { pid: ProcessId }
) {}

/** The error code that Node reports when no process has the ID. */
const NoSuchProcessCode = Schema.Struct({ code: Schema.Literal("ESRCH") });

/**
 * Whether a process with this ID still exists. Signal 0 sends nothing and only
 * asks the kernel: ESRCH means no process has the ID. Any other answer, such as
 * EPERM for a process that this user may not signal, means a process exists, so
 * it counts as alive.
 * @see https://man7.org/linux/man-pages/man2/kill.2.html
 */
const isProcessAlive = Effect.fn("contentAcceptance.isProcessAlive")(function* (
  pid: typeof ProcessId.Type
) {
  return yield* Effect.try({
    try: () => process.kill(pid, 0),
    catch: (error) =>
      Schema.is(NoSuchProcessCode)(error)
        ? new NoSuchProcess({ pid })
        : new ProcessExists({ pid }),
  }).pipe(
    Effect.as(true),
    Effect.catchTags({
      NoSuchProcess: () => Effect.succeed(false),
      ProcessExists: () => Effect.succeed(true),
    })
  );
});

/** The text a lease holds: its process ID as decimal digits, with no sign and no leading zero. */
const LeaseProcessId = Schema.String.check(
  Schema.isPattern(/^[1-9][0-9]*$/u)
).pipe(Schema.decodeTo(ProcessId, SchemaTransformation.numberFromString));

const LEASE_IN_USE =
  "The local build runtime is in use; existing state is preserved.";

const leaseInUse = () => acceptanceRuntimeError(LEASE_IN_USE);

/** Writes this process as the lease holder; fails with AlreadyExists while a lease file exists. */
const writeLease = Effect.fn("contentAcceptance.writeLease")(function* (
  lock: string
) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.writeFileString(lock, String(process.pid), {
    mode: 0o600,
    flag: "wx",
  });
});

/**
 * Replaces a lease that no live process holds: one whose process has exited, or
 * whose content is not a process ID. A lease that a live process holds is refused.
 */
const replaceStaleLease = Effect.fn("contentAcceptance.replaceStaleLease")(
  function* (lock: string) {
    const fs = yield* FileSystem.FileSystem;
    const recorded = yield* fs.readFileString(lock);
    const holder = Schema.decodeOption(LeaseProcessId)(recorded);
    if (Option.isSome(holder) && (yield* isProcessAlive(holder.value))) {
      return yield* leaseInUse();
    }
    yield* fs.remove(lock, { force: true });
    yield* writeLease(lock);
  }
);

/**
 * Excludes cleanup or another start while this caller owns the retained runtime.
 * A lease that a run left behind without releasing it is replaced, unless a live
 * process still holds it.
 */
export const leaseLocalRuntime = Effect.fn(
  "contentAcceptance.leaseLocalRuntime"
)(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const lock = `${root}/.cache/acceptance/using`;
  yield* Effect.acquireRelease(
    writeLease(lock).pipe(
      Effect.catchIf(
        (error) => error.reason._tag === "AlreadyExists",
        () => replaceStaleLease(lock)
      ),
      Effect.mapError(leaseInUse)
    ),
    () => fs.remove(lock, { force: true }).pipe(Effect.orDie)
  );
});
