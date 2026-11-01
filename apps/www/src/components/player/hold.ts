import { Array as Arr, Number as Num } from "effect";
import { createStore } from "zustand";

/**
 * The texts a paper waits for, and reads at one time: more than the tallest screen shows at once, so what comes later
 * lands below it. The server answers every read of one request in one message, so a long paper that asked for all its
 * texts at once would wait for its last page to show its first, and every student of a room would ask at one moment.
 */
const HELD_TEXTS = 8;

/** What a paper still waits for, and the actions that end the wait, which never starts again. */
interface PaperHold {
  /** Whether the code that draws the paper's texts stands ready, so a text draws in the frame it arrives. */
  readonly drawable: boolean;
  /** Reads the text the reader stands on next, and the texts after it, wherever the reader went. */
  readonly hurry: (key: string) => void;
  /** Takes that code as ready. */
  readonly prime: () => void;
  /** The keys of the texts that wait for their turn to read, in the order they will read. */
  readonly queued: readonly string[];
  /** The keys of the texts being read now. */
  readonly reading: readonly string[];
  /** Ends the wait, for a text that never answers. */
  readonly release: () => void;
  /** Takes one text out of the wait, once it can draw, and gives its place to the next text. */
  readonly settle: (key: string) => void;
  /** The keys of the texts the paper still waits for. */
  readonly waiting: readonly string[];
}

/** Fills the texts being read from the front of the queue, up to the paper's limit. */
const nextTurns = (reading: readonly string[], queued: readonly string[]) => {
  const [turns, rest] = Arr.splitAt(
    queued,
    Num.max(0, HELD_TEXTS - reading.length)
  );
  return { queued: rest, reading: Arr.appendAll(reading, turns) };
};

/**
 * Creates the wait of one paper, for the first of its `keys`, and for its code unless it is `drawable` already, with
 * its texts in their turns. Each paper creates its own, once.
 */
export const createPaperHold = (keys: readonly string[], drawable: boolean) =>
  createStore<PaperHold>()((set) => ({
    drawable,
    hurry: (key) =>
      set(({ queued, reading }) => {
        const [passed, ahead] = Arr.span(queued, (text) => text !== key);
        return nextTurns(
          Arr.appendAll(reading, Arr.take(ahead, 1)),
          Arr.appendAll(Arr.drop(ahead, 1), passed)
        );
      }),
    prime: () => set({ drawable: true }),
    release: () => set({ drawable: true, waiting: [] }),
    settle: (key) =>
      set(({ queued, reading, waiting }) => ({
        ...nextTurns(
          Arr.filter(reading, (text) => text !== key),
          queued
        ),
        waiting: Arr.filter(waiting, (held) => held !== key),
      })),
    ...nextTurns([], Arr.dedupe(keys)),
    waiting: Arr.take(keys, HELD_TEXTS),
  }));
