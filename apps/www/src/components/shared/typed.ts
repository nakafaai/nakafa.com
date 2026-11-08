import { Function as Fn, Option, String as Str } from "effect";
import { type RefObject, useEffectEvent, useLayoutEffect } from "react";

/**
 * Keeps the words a reader typed into a field before React took the page over.
 * A field drawn in the page's first HTML takes typing from the first paint, and
 * React hydrates a controlled field without its value, so those words stay in the
 * field but not in the draft that holds it: what reads the draft, such as a send
 * button, sees nothing, and the next render writes the empty draft back. When the
 * field mounts, the draft takes the words, unless it already holds words of its own.
 */
export function useEarlyTyping(
  field: RefObject<HTMLTextAreaElement | null>,
  text: string,
  setText: (typed: string) => void
) {
  const keepTyped = useEffectEvent(() => {
    Option.fromNullishOr(field.current).pipe(
      Option.map((element) => element.value),
      Option.filter(Str.isNonEmpty),
      Option.filter(() => Str.isEmpty(text)),
      Option.match({ onNone: Fn.constVoid, onSome: setText })
    );
  });
  useLayoutEffect(() => {
    keepTyped();
  }, []);
}
