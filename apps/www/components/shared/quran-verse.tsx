import { BookOpen02Icon, PlayIcon, StopIcon } from "@hugeicons/core-free-icons";
import type { Surah } from "@repo/contents/_types/quran";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { buttonVariants } from "@repo/design-system/lib/button";
import { cn } from "@repo/design-system/lib/utils";
import type { Locale } from "next-intl";
import type { QuranControlLabels } from "@/components/shared/quran-controls";
import { QuranText } from "@/components/shared/quran-text";

interface Props {
  id: string;
  index: number;
  isLast: boolean;
  labels: QuranControlLabels;
  locale: Locale;
  verse: Surah["verses"][number];
  verseLabel: string;
}

const verseButtonClassName = buttonVariants({
  size: "icon",
  variant: "outline",
});

const audioButtonClassName = cn(
  verseButtonClassName,
  "group data-[state=playing]:border-destructive data-[state=playing]:bg-destructive data-[state=playing]:text-destructive-foreground data-[state=playing]:hover:bg-[color-mix(in_oklch,var(--destructive)_90%,var(--background))]"
);

/**
 * Renders one delegated audio button without per-verse client hydration.
 */
function QuranAudioButton({
  index,
  labels,
}: {
  index: number;
  labels: QuranControlLabels;
}) {
  return (
    <button
      aria-label={labels.playAudio}
      className={audioButtonClassName}
      data-quran-audio-index={index}
      data-state="idle"
      type="button"
    >
      <HugeIcons
        className="group-data-[state=playing]:hidden"
        icon={PlayIcon}
      />
      <HugeIcons
        className="hidden group-data-[state=playing]:block"
        icon={StopIcon}
      />
      <span className="sr-only" data-quran-audio-label>
        {labels.playAudio}
      </span>
    </button>
  );
}

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
  id,
  index,
  isLast,
  labels,
  locale,
  verse,
  verseLabel,
}: Props) {
  const transliteration = verse.text.transliteration.en;
  const translation = verse.translation[locale] ?? verse.translation.en;

  return (
    <div
      className={cn(
        "mb-6 space-y-6 border-b pb-6 [contain-intrinsic-size:0_32rem] [content-visibility:auto]",
        isLast && "mb-0 border-b-0 pb-0"
      )}
      key={verse.number.inQuran}
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
          <QuranAudioButton index={index} labels={labels} />
          {locale === "id" && (
            <QuranInterpretationButton
              index={index}
              label={labels.interpretation}
            />
          )}
        </div>
      </div>
      <QuranText>{verse.text.arab}</QuranText>
      <div className="flex flex-col gap-2">
        <p className="text-pretty text-muted-foreground text-sm italic leading-relaxed">
          {transliteration}
        </p>
        <p className="text-pretty leading-relaxed">{translation}</p>
      </div>
    </div>
  );
}
