import { Button } from "@repo/design-system/components/ui/button";
import {
  ARABIC_LETTERS,
  ARABIC_MARKS,
  ARABIC_PUNCTUATION,
} from "@repo/design-system/lib/arabic/keys";
import { Array as Arr } from "effect";
import { type ReactNode, use } from "react";
import { useTranslations } from "use-intl";

/**
 * The tatweel a mark is shaped on in its key. Amiri carries the tatweel and every mark, so Amiri places the mark as it
 * would over a letter; the dotted circle U+25CC is in none of Amiri's subsets, and a key shaped on it fell back to a
 * face without the marks and drew two empty boxes.
 */
const MARK_SEAT = "\u0640";

/** Amiri's Arabic face, loading once for the page: the keypad waits for it, so no key ever draws in a fallback face. */
let amiri: Promise<unknown> | undefined;

/**
 * Starts loading Amiri's Arabic face for the keypad, once. The keypad renders only after a press in the browser, and
 * its faces load with optional display, so a keypad drawn before Amiri arrived would keep the system face.
 */
function amiriReady() {
  amiri ??= document.fonts.load("1em Amiri", `${MARK_SEAT}\u064e\u0628`);
  return amiri;
}

/**
 * An on-screen Arabic keypad: the harakat on top, each drawn over a dotted circle and named for
 * assistive technology, then the letters in hijaiyah order with the hamza and its seats, then the
 * Arabic punctuation and a space. A press types its key through `onKey` and keeps the focus where it
 * was, in the text being written, so the caret never jumps. Every key draws in Amiri: the keypad suspends until
 * Amiri's Arabic face has loaded, so its caller wraps it in Suspense.
 */
function ArabicKeypad({ onKey }: { onKey: (text: string) => void }) {
  const t = useTranslations("Common");
  use(amiriReady());

  return (
    <div
      className="flex flex-col gap-2"
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
      <div className="flex gap-1">
        {Arr.map(ARABIC_PUNCTUATION, (mark) => (
          <ArabicKey key={mark} label={mark} onKey={onKey} text={mark}>
            {mark}
          </ArabicKey>
        ))}
        <Button
          className="flex-1"
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
 * A mark as its key shows it: shaped on the tatweel in Amiri, with the tatweel's stroke left unpainted and a dotted
 * circle drawn where a letter would stand. Measured in Amiri, the stroke lies between 61% and 67% of the box that
 * `py-[0.5em]` and `leading-none` give, which holds every mark above and below it; the circle sits halfway between
 * the marks above and the marks below.
 */
function MarkFace({ mark }: { mark: string }) {
  return (
    <span
      aria-hidden="true"
      className="relative inline-block bg-clip-text py-[0.5em] leading-none [-webkit-text-fill-color:transparent] [background-image:linear-gradient(to_bottom,currentColor_61%,transparent_61%_67%,currentColor_67%)]"
    >
      {`${MARK_SEAT}${mark}`}
      <span className="absolute inset-x-0 top-[54%] mx-auto size-[0.85em] -translate-y-1/2 rounded-full border border-current border-dotted opacity-50" />
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
      className="font-quran text-lg"
      onClick={() => onKey(text)}
      onMouseDown={(event) => event.preventDefault()}
      size="icon-sm"
      type="button"
      variant="outline"
    >
      {children}
    </Button>
  );
}

export { ArabicKeypad };
