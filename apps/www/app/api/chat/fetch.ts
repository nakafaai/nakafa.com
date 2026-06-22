/**
 * Coordinates the one permitted current-page fetch across repair and execution.
 *
 * Repair can reserve the fetch for a malformed first Nakafa call, and the
 * following tool execution consumes that reservation. Later malformed calls no
 * longer get repaired into repeated current-page reads.
 */
export function createPageFetchState(needsPageFetch: boolean) {
  let consumed = false;
  let repairReservation = false;

  /** Reserves the one current-page fetch for a repaired Nakafa tool call. */
  function reserveForRepair() {
    if (consumed || !needsPageFetch) {
      return false;
    }

    consumed = true;
    repairReservation = true;
    return true;
  }

  /** Claims the current-page fetch for a Nakafa tool execution. */
  function consumeForTool() {
    if (repairReservation) {
      repairReservation = false;
      return true;
    }

    if (consumed || !needsPageFetch) {
      return false;
    }

    consumed = true;
    return true;
  }

  return {
    consumeForTool,
    reserveForRepair,
  };
}
