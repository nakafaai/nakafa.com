import { Button } from "@repo/design-system/components/ui/button";
import {
  ARABIC_LETTERS,
  ARABIC_MARKS,
  ARABIC_PUNCTUATION,
} from "@repo/design-system/lib/arabic/keys";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";

/** The dotted circle a mark sits on in its key, so a mark without its letter still shows. */
const MARK_BASE = "◌";

/**
 * An on-screen Arabic keypad: the harakat on top, each drawn on a dotted circle and named for
 * assistive technology, then the letters in hijaiyah order with the hamza and its seats, then the
 * Arabic punctuation and a space. A press types its key through `onKey` and keeps the focus where it
 * was, in the text being written, so the caret never jumps. Every key draws in Amiri.
 */
function ArabicKeypad({ onKey }: { onKey: (text: string) => void }) {
  const t = useTranslations("Common");

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
            {`${MARK_BASE}${mark}`}
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
