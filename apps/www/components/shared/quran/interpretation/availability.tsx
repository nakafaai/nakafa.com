import type { QuranViewTafsirAccessV2 } from "@repo/backend/client/quran/v2/view";

/** Renders signed locale Tafsir availability without app-owned source data. */
export function QuranInterpretationAvailability({
  access,
}: {
  access: QuranViewTafsirAccessV2;
}) {
  return (
    <div
      className="mb-6 space-y-2 text-pretty text-muted-foreground text-sm leading-relaxed"
      data-quran-interpretation-availability
    >
      <p>{access.notice}</p>
      <a
        className="inline-block font-medium text-foreground underline underline-offset-4"
        href={access.source.updateUrl}
        rel="noopener noreferrer"
        target="_blank"
      >
        {access.source.label}
      </a>
    </div>
  );
}
