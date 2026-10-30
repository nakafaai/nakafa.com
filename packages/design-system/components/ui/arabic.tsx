import { Button } from "@repo/design-system/components/ui/button";
import {
  ARABIC_LETTERS,
  ARABIC_MARKS,
  ARABIC_PUNCTUATION,
} from "@repo/design-system/lib/arabic/keys";
import { Array as Arr, Effect, Fiber } from "effect";
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
 * was, in the text being written, so the caret never jumps. Every key draws in Amiri Quran. The keypad
 * is 20rem wide and narrows with its container, and its keys share the width of their row, so it fits
 * a 320px screen.
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
            <KeyGlyph text={letter} />
          </ArabicKey>
        ))}
      </div>
      <div className="grid grid-cols-9 gap-1">
        {Arr.map(ARABIC_PUNCTUATION, (mark) => (
          <ArabicKey key={mark} label={mark} onKey={onKey} text={mark}>
            <KeyGlyph text={mark} />
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
 * above and the marks below. The marks reach 1.8em from the highest to the lowest, taller than a key holds at the
 * key's size, so the face draws at 0.8em of it and every mark stays inside its key.
 */
function MarkFace({ mark }: { mark: string }) {
  return (
    <span
      aria-hidden="true"
      className="relative inline-block bg-clip-text pt-[0.2em] pb-[0.8em] text-[0.8em] leading-none [-webkit-text-fill-color:transparent] [background-image:linear-gradient(to_bottom,currentColor_50%,transparent_50%_74%,currentColor_74%)]"
    >
      {`${MARK_SEAT}${mark}`}
      <span className="absolute top-[52%] left-1/2 size-[0.85em] -translate-x-1/2 -translate-y-1/2 rounded-full border border-current border-dotted opacity-50" />
    </span>
  );
}

/** A letter or a mark of punctuation as its key shows it, its ink at the middle of the key (`centreInk`). */
function KeyGlyph({ text }: { text: string }) {
  return (
    <span aria-hidden="true" className="inline-block" ref={centreInk}>
      {text}
    </span>
  );
}

/**
 * Moves a key's glyph so the middle of its ink sits at the middle of its key. A line box sets Amiri Quran's
 * baseline 0.59em below its middle, as its ascent is far taller than its descent, so a glyph placed by its line
 * sits low, and each letter's ink has its own height and its own place on the baseline. The glyph is measured as
 * drawn: its run's place on the page, and the face's ink box of the text from the canvas. A face still loading is
 * waited for, since its block display hides the glyph until then.
 */
function centreInk(node: HTMLSpanElement | null) {
  if (node === null) {
    return;
  }
  const style = getComputedStyle(node);
  const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const text = node.textContent ?? "";
  if (document.fonts.check(font, text)) {
    placeInk(node, font, text);
    return;
  }
  const fiber = Effect.runFork(
    Effect.tryPromise(() => document.fonts.load(font, text)).pipe(
      Effect.ignore,
      Effect.andThen(Effect.sync(() => placeInk(node, font, text)))
    )
  );
  return () => {
    Effect.runFork(Fiber.interrupt(fiber));
  };
}

/**
 * Translates a glyph by the distance from the middle of its ink to the middle of its key. The run's box starts at
 * the face's ascent above the baseline, which the browser rounds to a whole pixel, and the canvas gives the ink's
 * reach above and below the baseline and to either side of the run's start. The page's boxes carry the scale of an
 * opening popover, so the distance is divided by it.
 */
function placeInk(node: HTMLSpanElement, font: string, text: string) {
  const key = node.closest("button");
  const context = document.createElement("canvas").getContext("2d");
  if (key === null || context === null || node.firstChild === null) {
    return;
  }
  context.font = font;
  const ink = context.measureText(text);
  const range = document.createRange();
  range.selectNodeContents(node);
  const run = range.getBoundingClientRect();
  const box = key.getBoundingClientRect();
  const scale = box.width / key.offsetWidth;
  const inkMiddle = {
    x:
      run.left +
      (scale * (ink.actualBoundingBoxRight - ink.actualBoundingBoxLeft)) / 2,
    y:
      run.top +
      scale *
        (Math.round(ink.fontBoundingBoxAscent) +
          (ink.actualBoundingBoxDescent - ink.actualBoundingBoxAscent) / 2),
  };
  const x = (box.left + box.width / 2 - inkMiddle.x) / scale;
  const y = (box.top + box.height / 2 - inkMiddle.y) / scale;
  node.style.translate = `${x}px ${y}px`;
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
      className="w-full px-0 font-quran text-lg"
      onClick={() => onKey(text)}
      onMouseDown={(event) => event.preventDefault()}
      size="sm"
      type="button"
      variant="outline"
    >
      {children}
    </Button>
  );
}

export { ArabicKeypad };
