import { Button } from "@repo/design-system/components/ui/button";
import {
  ARABIC_LETTERS,
  ARABIC_MARKS,
  ARABIC_PUNCTUATION,
} from "@repo/design-system/lib/arabic/keys";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";

/**
 * The tatweel a mark is shaped on in its key. Amiri Quran carries the tatweel and every mark, so it places the mark as it
 * would over a letter; the dotted circle U+25CC is in none of Amiri Quran's subsets, and a key shaped on it fell back to a
 * face without the marks and drew two empty boxes.
 */
const MARK_SEAT = "\u0640";

/**
 * An on-screen Arabic keypad: the harakat on top, each drawn over a dotted circle and named for
 * assistive technology, then the letters in hijaiyah order with the hamza and its seats, then the
 * Arabic punctuation and a space. A press types its key through `onKey` and keeps the focus where it
 * was, in the text being written, so the caret never jumps. Every key draws in Amiri Quran, its letters in
 * the keypad's face with balanced metrics (`font-keypad`), so each sits inside its key near the middle. The
 * keypad is 20rem wide and narrows with its container, and its keys share the width of their row, so it
 * fits a 320px screen.
 */
function ArabicKeypad({ onKey }: { onKey: (text: string) => void }) {
  const t = useTranslations("Common");

  return (
    <div
      className="flex w-80 max-w-full flex-col gap-2"
      data-slot="arabic-keypad"
      dir="rtl"
      lang="ar"
    >
      <div className="grid grid-cols-8 gap-1">
        {Arr.map(ARABIC_MARKS, ({ mark, name }) => (
          <ArabicKey key={name} label={t(name)} onKey={onKey} text={mark}>
            <MarkFace mark={mark} />
          </ArabicKey>
        ))}
      </div>
      <div className="grid grid-cols-9 gap-1">
        {Arr.map(ARABIC_LETTERS, (letter) => (
          <ArabicKey key={letter} label={letter} onKey={onKey} text={letter}>
            {letter}
          </ArabicKey>
        ))}
      </div>
      <div className="grid grid-cols-9 gap-1">
        {Arr.map(ARABIC_PUNCTUATION, (mark) => (
          <ArabicKey key={mark} label={mark} onKey={onKey} text={mark}>
            {mark}
          </ArabicKey>
        ))}
        <Button
          className="col-span-6"
          onClick={() => onKey(" ")}
          onMouseDown={(event) => event.preventDefault()}
          size="sm"
          type="button"
          variant="outline"
        >
          {t("arabic-space")}
        </Button>
      </div>
    </div>
  );
}

/**
 * A mark as its key shows it: shaped on the tatweel in Amiri Quran, with the tatweel's stroke left unpainted and a
 * dotted circle drawn where a letter would stand. Amiri Quran's tall ascent sets the baseline low in a `leading-none`
 * line, so the padding is 0.2em above and 0.8em below, which centres the marks in the 2em box. Measured in Amiri Quran,
 * the marks above end at 23% of the box and the marks below start at 80%, the stroke lies between 60% and 66%, and the
 * unpainted band from 50% to 74% holds it with room for rounding; the circle sits at 52%, halfway between the marks
 * above and the marks below. The face keeps Amiri Quran's own metrics, which these places were measured in, and
 * draws at 0.9em of the key, since the marks reach 1.8em from the highest to the lowest.
 */
function MarkFace({ mark }: { mark: string }) {
  return (
    <span
      aria-hidden="true"
      className="relative inline-block bg-clip-text pt-[0.2em] pb-[0.8em] font-quran text-[0.9em] leading-none [-webkit-text-fill-color:transparent] [background-image:linear-gradient(to_bottom,currentColor_50%,transparent_50%_74%,currentColor_74%)]"
    >
      {`${MARK_SEAT}${mark}`}
      <span className="absolute top-[52%] left-1/2 size-[0.85em] -translate-x-1/2 -translate-y-1/2 rounded-full border border-current border-dotted opacity-50" />
    </span>
  );
}

/** One key of the keypad: it types `text`, and keeps the focus in the text being written. */
function ArabicKey({
  children,
  label,
  onKey,
  text,
}: {
  children: ReactNode;
  label: string;
  onKey: (text: string) => void;
  text: string;
}) {
  return (
    <Button
      aria-label={label}
      className="w-full px-0 font-keypad text-lg"
      onClick={() => onKey(text)}
      onMouseDown={(event) => event.preventDefault()}
      size="default"
      type="button"
      variant="outline"
    >
      {children}
    </Button>
  );
}

export { ArabicKeypad };
