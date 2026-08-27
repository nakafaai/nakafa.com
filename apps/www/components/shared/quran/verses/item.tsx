import type { QuranViewVerse } from "@repo/backend/client/quran/view";
import { cn } from "@repo/design-system/lib/utils";
import type { ReactNode } from "react";
import { QuranText } from "@/components/shared/quran/text";
import { QuranVerseTranslation } from "@/components/shared/quran/verses/translation";

interface Props {
  action?: ReactNode;
  id: string;
  isLast: boolean;
  translationNotesLabel: string;
  verse: QuranViewVerse;
  verseLabel: string;
}

/** Renders one Quran verse as SEO-visible server content. */
export function QuranVerseItem({
  action,
  id,
  isLast,
  translationNotesLabel,
  verse,
  verseLabel,
}: Props) {
  return (
    <div
      className={cn(
        "mb-6 space-y-6 border-b pb-6 content-auto-quran-verse",
        isLast && "mb-0 border-b-0 pb-0"
      )}
      data-quran-verse={verse.number.inSurah}
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

        {action ? (
          <div className="flex items-center gap-2">{action}</div>
        ) : null}
      </div>
      <QuranText data-quran-arabic>{verse.arabic}</QuranText>
      <QuranVerseTranslation
        id={id}
        label={translationNotesLabel}
        translation={verse.translation}
        verseLabel={verseLabel}
      />
    </div>
  );
}
