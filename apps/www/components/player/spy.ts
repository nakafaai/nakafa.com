/**
 * Distance from the viewport top to the reading line: the 64 px header, the
 * 16 px scroll padding below it, and 8 px into the question.
 */
export const PLAYER_READING_LINE = 88;

/** Scroll-spy state built from intersection observer entries. */
export interface PlayerSpy {
  /** The question under the reading line, kept while the line is in a gap. */
  readonly band: string | null;
  /** Whether the end of the list is visible above the footer. */
  readonly end: boolean;
}

/** One question's crossing of the reading band. */
export interface PlayerSpyEntry {
  readonly intersecting: boolean;
  readonly key: string;
}

/** Root margin that shrinks the viewport to a 1 px band at the reading line. */
export function readingBand(viewportHeight: number) {
  const bottom = Math.max(0, viewportHeight - PLAYER_READING_LINE - 1);
  return `-${PLAYER_READING_LINE}px 0px -${bottom}px 0px`;
}

/** Applies one band batch: the last question entering the line wins. */
export function nextSpyBand(
  spy: PlayerSpy,
  entries: readonly PlayerSpyEntry[]
): PlayerSpy {
  const entered = entries.filter((entry) => entry.intersecting).at(-1);
  return entered ? { ...spy, band: entered.key } : spy;
}

/** The question to mark current: the last one at the end, else the band. */
export function spyCandidate(spy: PlayerSpy, lastKey: string | null) {
  return spy.end ? lastKey : spy.band;
}
