import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import { randomUuid } from "@repo/utilities/uuid";
import {
  Array as Arr,
  Effect,
  FileSystem,
  Option,
  Schema,
  SchemaTransformation,
  Stream,
} from "effect";
import { ChildProcess } from "effect/process";

/**
 * A process ID that a claim may name: a positive integer up to 2147483647, the
 * largest signed 32-bit value, so a larger number names no process.
 */
const ProcessId = Schema.Int.check(
  Schema.isGreaterThan(0),
  Schema.isLessThanOrEqualTo(2_147_483_647)
);

/** A process ID in a claim name: decimal digits, with no sign and no leading zero. */
const ProcessIdText = Schema.String.check(
  Schema.isPattern(/^[1-9][0-9]*$/u)
).pipe(Schema.decodeTo(ProcessId, SchemaTransformation.numberFromString));

/**
 * A claim file is `using.<process ID>.<unique part>`. The unique part is a random
 * UUID, so two claims of one process never share a name, and no other file of
 * the runtime directory matches.
 */
const CLAIM_NAME = /^using\.([^.]*)\.[^.]+$/u;

const LEASE_IN_USE =
  "The local build runtime is in use; existing state is preserved.";

const UNREADABLE_START =
  "The local build runtime could not read the start time of this process, so no lease was recorded.";

/** The process that a claim name names, or nothing when the name does not hold a canonical process ID. */
const claimHolder = (name: string) =>
  Option.fromNullishOr(CLAIM_NAME.exec(name)?.[1]).pipe(
    Option.flatMap(Schema.decodeOption(ProcessIdText))
  );

/**
 * The start time that the operating system records for a process, or an empty
 * text when `ps` reports none, such as when no process has the ID. `ps` prints
 * the same text for as long as one process runs, so a process ID that another
 * process now owns prints a different text. The text is read in UTC and the C
 * locale, so it never depends on the caller's time zone.
 */
export const processStart = Effect.fn("contentAcceptance.processStart")(
  function* (pid: typeof ProcessId.Type) {
    const child = yield* ChildProcess.make(
      "ps",
      ["-o", "lstart=", "-p", String(pid)],
      {
        env: { LC_ALL: "C", TZ: "UTC" },
        extendEnv: true,
        stderr: "ignore",
        stdin: "ignore",
      }
    );
    const [text, code] = yield* Effect.all(
      [child.stdout.pipe(Stream.decodeText(), Stream.mkString), child.exitCode],
      { concurrency: "unbounded" }
    );
    return code === 0 ? text.trim() : "";
  },
  Effect.scoped
);

/**
 * Whether a claim still belongs to a live holder: its process runs with the start
 * time the claim recorded. An empty claim is still being written by a live holder,
 * so it is live too. A claim that vanished was released, so it is not live.
 */
const claimIsLive = Effect.fn("contentAcceptance.claimIsLive")(function* (
  claim: string,
  holder: typeof ProcessId.Type
) {
  const fs = yield* FileSystem.FileSystem;
  const start = yield* processStart(holder);
  if (start === "") {
    return false;
  }
  const recorded = yield* fs.readFileString(claim).pipe(
    Effect.asSome,
    Effect.catchIf(
      (error) => error.reason._tag === "NotFound",
      () => Effect.succeed(Option.none<string>())
    )
  );
  return (
    Option.isSome(recorded) &&
    (recorded.value === "" || recorded.value === start)
  );
});

/**
 * Whether a claim belongs to a live holder. A claim that no live holder owns is
 * removed, so a stopped run never blocks the next one.
 */
const judgeClaim = Effect.fn("contentAcceptance.judgeClaim")(function* (
  directory: string,
  name: string
) {
  const fs = yield* FileSystem.FileSystem;
  const claim = `${directory}/${name}`;
  const holder = claimHolder(name);
  if (Option.isSome(holder) && (yield* claimIsLive(claim, holder.value))) {
    return true;
  }
  yield* fs.remove(claim, { force: true });
  return false;
});

/**
 * Removes the claims that no live holder owns, and fails with the in-use error
 * when a live holder owns another claim of the directory.
 */
const refuseLiveHolders = Effect.fn("contentAcceptance.refuseLiveHolders")(
  function* (directory: string, own: string) {
    const fs = yield* FileSystem.FileSystem;
    const names = yield* fs.readDirectory(directory);
    const others = Arr.filter(
      names,
      (name) => CLAIM_NAME.test(name) && name !== own
    );
    const held = yield* Effect.forEach(others, (name) =>
      judgeClaim(directory, name)
    );
    if (Arr.some(held, (live) => live)) {
      return yield* acceptanceRuntimeError(LEASE_IN_USE);
    }
  }
);

/**
 * Writes this process's claim, then refuses the start when a live holder owns
 * another claim. Each start writes its claim before it reads the others, so two
 * starts that race never both succeed: the later one reads the earlier claim.
 */
const claimLease = Effect.fn("contentAcceptance.claimLease")(function* (
  directory: string
) {
  const fs = yield* FileSystem.FileSystem;
  const start = yield* processStart(process.pid);
  // Without this process's start time, every other start would judge its claim
  // dead, so a `ps` that cannot report it must refuse the lease instead.
  if (start === "") {
    return yield* acceptanceRuntimeError(UNREADABLE_START);
  }
  const own = `using.${process.pid}.${yield* randomUuid}`;
  const claim = `${directory}/${own}`;
  yield* Effect.gen(function* () {
    yield* fs.writeFileString(claim, start, { mode: 0o600, flag: "wx" });
    yield* refuseLiveHolders(directory, own);
  }).pipe(
    Effect.onError(() => fs.remove(claim, { force: true }).pipe(Effect.ignore))
  );
  return claim;
});

/**
 * Excludes cleanup or another start while this caller owns the retained runtime.
 * Each process holds the runtime through its own claim file, so no start ever
 * overwrites another start's claim. A claim that no live process holds is
 * removed, and a live holder refuses the start.
 */
export const leaseLocalRuntime = Effect.fn(
  "contentAcceptance.leaseLocalRuntime"
)(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  yield* Effect.acquireRelease(
    claimLease(`${root}/.cache/acceptance`),
    (claim) => fs.remove(claim, { force: true }).pipe(Effect.orDie)
  );
});
