import { Array as Arr, Schema } from "effect";

/** A closed sitting as the strip counts it: whether its results wait for their release. */
const WaitingRow = Schema.Struct({
  canRelease: Schema.Boolean,
});

/** How many of the closed sittings wait for their results to be released, among the rows the read returned. */
export const waitingOf = (closed: readonly (typeof WaitingRow.Type)[]) =>
  Arr.filter(closed, (result) => result.canRelease).length;
