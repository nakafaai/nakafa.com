import { BookOpen02Icon } from "@hugeicons/core-free-icons";
import type { QuranViewVerse } from "@repo/backend/client/quran/view";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { buttonVariants } from "@repo/design-system/lib/button";
import { cn } from "@repo/design-system/lib/utils";
import { QuranText } from "@/components/shared/quran-text";

interface Props {
  hasInterpretation: boolean;
  id: string;
  interpretationLabel: string;
  isLast: boolean;
  verse: QuranViewVerse;
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
  label,
  verseNumber,
}: {
  label: string;
  verseNumber: number;
}) {
  return (
    <button
      aria-label={label}
      className={cn(verseButtonClassName, "group")}
      data-quran-interpretation-verse={verseNumber}
      type="button"
    >
      <HugeIcons
        aria-hidden="true"
        className="group-data-loading:hidden"
        icon={BookOpen02Icon}
      />
      <Spinner aria-hidden="true" className="hidden group-data-loading:block" />
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
  interpretationLabel,
  isLast,
  verse,
  verseLabel,
}: Props) {
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
              label={interpretationLabel}
              verseNumber={verse.number.inSurah}
            />
          )}
        </div>
      </div>
      <QuranText>{verse.arabic}</QuranText>
      <p className="text-pretty leading-relaxed">{verse.translation}</p>
    </div>
  );
}
