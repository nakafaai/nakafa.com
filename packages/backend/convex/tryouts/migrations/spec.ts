import type { PaginationOptions } from "convex/server";
import { Schema } from "effect";

/** Fixed page size that keeps each migration transaction deliberately small. */
export const tryoutIdentityPageSize = 16;

/** Stable phases used by the resumable try-out identity backfill. */
export const tryoutIdentityPhases = [
  "attempts",
  "progress",
  "placements",
] as const;
export type TryoutIdentityPhase = (typeof tryoutIdentityPhases)[number];

/** Returns the hard one-time migration bound for one durable table. */
export function tryoutIdentityLimit(phase: TryoutIdentityPhase) {
  if (phase === "placements") {
    return 2000;
  }
  return 100;
}

/** Expected failure raised when legacy state cannot map to one Aksara row. */
export class TryoutIdentityError extends Schema.TaggedError<TryoutIdentityError>()(
  "TryoutIdentityError",
  {
    code: Schema.String,
    message: Schema.String,
  }
) {}

/** Input required for one bounded migration page. */
export interface TryoutIdentityInput {
  readonly apply: boolean;
  readonly expectedRows: number;
  readonly paginationOpts: PaginationOptions;
  readonly phase: TryoutIdentityPhase;
  readonly snapshotId: string;
}

/** Receipt proving the exact bounded work performed by one migration page. */
export interface TryoutIdentityReceipt {
  readonly candidates: number;
  readonly continueCursor: string;
  readonly isDone: boolean;
  readonly processed: number;
  readonly updated: number;
}

/** Builds one typed fail-closed migration error. */
export function identityFailure(code: string, message: string) {
  return new TryoutIdentityError({ code, message });
}
