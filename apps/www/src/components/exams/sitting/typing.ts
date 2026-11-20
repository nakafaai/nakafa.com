import {
  useDebouncedCallback,
  useDidUpdate,
  useWindowEvent,
} from "@mantine/hooks";
import { useRef } from "react";

/** How long the student pauses typing before the answer is saved. */
const TYPING_PAUSE_MILLISECONDS = 800;

/** The longest the answer waits while the student keeps typing, so a long answer is saved as it grows. */
const TYPING_WAIT_MILLISECONDS = 4000;

/**
 * The save of one typed answer. The field shows each key at once and keeps the text in the browser on every key
 * (`write`), then sends it once the student pauses, leaves the field (`flush`), leaves the question, or the page
 * hides or closes, so a typed answer is not one save per key and a reload or a closed tab loses no key. Words saved
 * from another tab take the line's place (`line`) unless the student is typing in it, so a later key never writes
 * over words the field did not show.
 */
export function useSittingTyping({
  onKeep,
  onType,
  saved,
}: {
  /** Keeps the text in the browser until the server confirms it. */
  readonly onKeep?: ((text: string) => void) | undefined;
  /** Sends the text. */
  readonly onType: (text: string) => void;
  /** The text the server holds now, which a save from another tab changes. */
  readonly saved: string;
}) {
  const line = useRef<HTMLInputElement>(null);
  const save = useDebouncedCallback(onType, {
    delay: TYPING_PAUSE_MILLISECONDS,
    flushOnUnmount: true,
    maxWait: TYPING_WAIT_MILLISECONDS,
  });
  // A page that hides or closes unmounts nothing, so it sends the text waiting for a pause at once.
  useWindowEvent("pagehide", () => save.flush());
  useWindowEvent("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      save.flush();
    }
  });

  // The line takes its text once, so a save from elsewhere reaches it here. The page's own save only
  // repeats what the line shows.
  useDidUpdate(() => {
    const field = line.current;
    if (field !== null && field !== document.activeElement) {
      field.value = saved;
    }
  }, [saved]);

  return {
    /** Sends the text waiting for a pause at once. */
    flush: () => save.flush(),
    line,
    /** Keeps every key at once, and sends the text after a pause. */
    write: (text: string) => {
      onKeep?.(text);
      save(text);
    },
  };
}
