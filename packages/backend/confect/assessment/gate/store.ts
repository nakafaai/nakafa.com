import type { EndReason } from "@repo/backend/confect/assessment/gate/end";
import { Version } from "@repo/backend/confect/assessment/gate/rules";
import { type Effect, type Option, Schema } from "effect";

/** A device session of one attempt, as the web names it: one per sitting for the student's browser. */
export const DeviceId = Schema.NonEmptyString;
export type DeviceId = typeof DeviceId.Type;

/**
 * Which device session may write to an attempt. A try-out binds no device, so any
 * device writes (`free`). A sitting binds its attempt to one device (`bound`), or to
 * none while a proctor allows a new one (`unbound`). A retired device writes nothing
 * again, in either case.
 */
export const Binding = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("free") }),
  Schema.Struct({
    device: DeviceId,
    kind: Schema.Literal("bound"),
    retired: Schema.Array(DeviceId),
  }),
  Schema.Struct({
    kind: Schema.Literal("unbound"),
    retired: Schema.Array(DeviceId),
  }),
]);
export type Binding = typeof Binding.Type;

/**
 * The state of an attempt as data: `inProgress` and `locked` accept writes before the
 * deadline, `closing` waits to be submitted once its deadline passed, `submitted` is
 * final, and `expired` is a try-out that ran out of time.
 */
export const AttemptState = Schema.Literals([
  "inProgress",
  "locked",
  "closing",
  "submitted",
  "expired",
]);
export type AttemptState = typeof AttemptState.Type;

/** The attempt a write targets, as its store loaded it before any section row. */
export const Attempt = Schema.Struct({
  binding: Binding,
  /** When the attempt closes, in server milliseconds. */
  deadline: Schema.Finite,
  state: AttemptState,
});
export type Attempt = typeof Attempt.Type;

/**
 * What an answer's checked live context carries besides the store's rows: the
 * version of the question's latest admitted write, none before its first write.
 * Clearing the answer keeps that version, so an older write cannot come back.
 */
export const Answerable = Schema.Struct({
  version: Schema.Option(Version),
});
export type Answerable = typeof Answerable.Type;

/**
 * One open section as its store loaded it: its deadline, the store's integrity
 * checks of the rows that identify it, and the rest of the rows the write needs. The
 * rest loads and is checked only after the deadline rule passed, so a write that
 * arrives too late reads and fails on nothing beyond the section.
 */
export interface Stage<Live, E, R> {
  readonly deadline: number;
  readonly live: Effect.Effect<Live, E, R>;
  readonly verify: Effect.Effect<void, E>;
}

/**
 * One write's target as its store loaded it: whose it is, its attempt, and its section
 * stage, none for a section that never started or no longer accepts writes. The
 * section stage runs only after the owner and attempt rules pass.
 */
export interface Candidate<Live, E, R> {
  readonly attempt: Attempt;
  readonly owner: string;
  readonly section: Effect.Effect<Option.Option<Stage<Live, E, R>>, E, R>;
}

/**
 * What the gate needs from the store of one kind of attempt. Its failures pass
 * through the gate untouched as `E`, and `R` is its services. The store is a value,
 * not a service, because its target, row, and value types parameterize every program.
 */
export interface Store<
  Placement,
  Section,
  Answering extends Answerable,
  Live,
  Value,
  E,
  R,
> {
  /** Stores one admitted answer with its version, or clears the stored one for none. */
  readonly answer: (
    live: Answering,
    value: Value,
    now: number,
    version: Version
  ) => Effect.Effect<void, E, R>;
  /** Ends and scores the section for the reason its deadline decided. */
  readonly finish: (
    live: Live,
    reason: EndReason,
    now: number
  ) => Effect.Effect<void, E, R>;
  /** Loads the target of an answer or a flag, without reading its section. */
  readonly placement: (
    placement: Placement
  ) => Effect.Effect<Option.Option<Candidate<Answering, E, R>>, E, R>;
  /** Loads the target of a finish or a signal, without reading its section. */
  readonly section: (
    section: Section
  ) => Effect.Effect<Option.Option<Candidate<Live, E, R>>, E, R>;
}
