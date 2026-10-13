import type { EndReason } from "@repo/backend/confect/assessment/gate/end";
import { Version } from "@repo/backend/confect/assessment/gate/rules";
import {
  type Evaluated,
  ResponseSpec,
} from "@repo/backend/confect/response/model";
import { type Effect, type Option, Schema } from "effect";

/** The device session an attempt is bound to (CBT). Try-out attempts bind none. */
export const DeviceId = Schema.NonEmptyString.pipe(Schema.brand("DeviceId"));
export type DeviceId = typeof DeviceId.Type;

/** The attempt a write targets, as its store loaded it before any section row. */
export const Attempt = Schema.Struct({
  /** Whether the attempt still accepts writes. */
  open: Schema.Boolean,
  /** Whether a proctor locked it; try-out attempts never lock. */
  locked: Schema.Boolean,
  /** The device session it is bound to; try-out attempts bind none. */
  device: Schema.Option(DeviceId),
  /** When it closes, in server milliseconds. */
  deadline: Schema.Finite,
});
export type Attempt = typeof Attempt.Type;

/**
 * What an answer's checked live context carries besides the store's rows: the
 * frozen response a selection is evaluated against, and the version of the
 * question's latest admitted write, none before its first versioned write.
 * Clearing the answer keeps that version, so an older write cannot come back.
 */
export const Answerable = Schema.Struct({
  response: ResponseSpec,
  version: Schema.Option(Version),
});
export type Answerable = typeof Answerable.Type;

/**
 * One open section as its store loaded it: its deadline, the store's integrity
 * checks of the rows that identify it, and the rest of the rows the write
 * needs. The rest loads and is checked only after the deadline rule passed, so
 * a write that arrives too late reads and fails on nothing beyond the section,
 * and its checked rows become the live context.
 */
export interface Stage<Live, E, R> {
  readonly deadline: number;
  readonly live: Effect.Effect<Live, E, R>;
  readonly verify: Effect.Effect<void, E>;
}

/**
 * One write's target as its store loaded it: whose it is, its attempt, and its
 * section stage, none for a section that never started or no longer accepts
 * writes. The section stage runs only after the owner and attempt rules pass,
 * so a probe of another learner's target never reads, or fails on, their rows.
 */
export interface Candidate<Live, E, R> {
  readonly attempt: Attempt;
  readonly owner: string;
  readonly section: Effect.Effect<Option.Option<Stage<Live, E, R>>, E, R>;
}

/**
 * What the gate needs from the store of one kind of attempt. Its failures pass
 * through the gate untouched: `E` from its loads and integrity checks, `EA`
 * from its answer write, and `EF` from its finish write; `R` is its services.
 * The store is a value, not a service, because its target, row, and failure
 * types parameterize every program.
 */
export interface Store<
  Placement,
  Section,
  Answering extends Answerable,
  Live,
  E,
  EA,
  EF,
  R,
> {
  /** Stores one admitted answer with its version, or clears the stored one for none. */
  readonly answer: (
    live: Answering,
    answer: Option.Option<Evaluated>,
    now: number,
    version: Version
  ) => Effect.Effect<void, EA, R>;
  /** Ends and scores the section for the reason its deadline decided. */
  readonly finish: (
    live: Live,
    reason: EndReason,
    now: number
  ) => Effect.Effect<void, EF, R>;
  /** Loads the target of an answer, without reading its section. */
  readonly placement: (
    placement: Placement
  ) => Effect.Effect<Option.Option<Candidate<Answering, E, R>>, E, R>;
  /** Loads the target of a finish, without reading its section. */
  readonly section: (
    section: Section
  ) => Effect.Effect<Option.Option<Candidate<Live, E, R>>, E, R>;
}
