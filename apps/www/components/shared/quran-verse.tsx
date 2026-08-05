import { BookOpen02Icon } from "@hugeicons/core-free-icons";
import type { QuranRuntimeVerse } from "@nakafa/aksara-contracts/quran/spec";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { buttonVariants } from "@repo/design-system/lib/button";
import { cn } from "@repo/design-system/lib/utils";
import type { Locale } from "next-intl";
import { QuranText } from "@/components/shared/quran-text";

interface Props {
  hasInterpretation: boolean;
  id: string;
  index: number;
  interpretationLabel: string;
  isLast: boolean;
  locale: Locale;
  verse: QuranRuntimeVerse;
  verseLabel: string;
}

const verseButtonClassName = buttonVariants({
  size: "icon",
  variant: "outline",
});

/**
 * Renders one delegated tafsir button without mounting a drawer per verse.
 */
function QuranInterpretationButton({
  index,
  label,
}: {
  index: number;
  label: string;
}) {
  return (
    <button
      aria-label={label}
      className={verseButtonClassName}
      data-quran-interpretation-index={index}
      type="button"
    >
      <HugeIcons icon={BookOpen02Icon} />
      <span className="sr-only">{label}</span>
    </button>
  );
}

/**
 * Renders one Quran verse as SEO-visible server content with delegated controls.
 */
export function QuranVerse({
  hasInterpretation,
  id,
  index,
  interpretationLabel,
  isLast,
  locale,
  verse,
  verseLabel,
}: Props) {
  const translation = verse.translation[locale].text;

  return (
    <div
      className={cn(
        "mb-6 space-y-6 border-b pb-6 content-auto-quran-verse",
        isLast && "mb-0 border-b-0 pb-0"
      )}
    >
      <div className="flex items-center gap-4">
        <a
          className="flex w-full flex-1 shrink-0 scroll-mt-44 outline-none ring-0"
          href={`#${id}`}
          id={id}
        >
          <div className="flex size-9 items-center justify-center rounded-full border border-primary bg-secondary text-secondary-foreground">
            <span className="font-mono text-xs tracking-tighter">
              {verse.number.inSurah}
            </span>
            <h2 className="sr-only">{verseLabel}</h2>
          </div>
        </a>

        <div className="flex items-center gap-2">
          {hasInterpretation && (
            <QuranInterpretationButton
              index={index}
              label={interpretationLabel}
            />
          )}
        </div>
      </div>
      <QuranText>{verse.text.arabic}</QuranText>
      <p className="text-pretty leading-relaxed">{translation}</p>
    </div>
  );
}
