import type { QuranViewSourcesV2 } from "@repo/backend/client/quran/v2/view";

interface Props {
  arabicLabel: string;
  label: string;
  sources: QuranViewSourcesV2;
  translationLabel: string;
}

/** Renders the signed Arabic and selected translation provenance. */
export function QuranSources({
  arabicLabel,
  label,
  sources,
  translationLabel,
}: Props) {
  return (
    <section aria-label={label} className="mb-6 text-sm">
      <details className="group rounded-lg border bg-muted/20 px-4 py-3">
        <summary className="cursor-pointer font-medium text-foreground">
          {label}
        </summary>
        <dl className="mt-4 space-y-4">
          <Source label={arabicLabel} source={sources.arabic} />
          <Source label={translationLabel} source={sources.translation} />
        </dl>
      </details>
    </section>
  );
}

function Source({
  label,
  source,
}: {
  label: string;
  source: QuranViewSourcesV2[keyof QuranViewSourcesV2];
}) {
  return (
    <div className="space-y-1">
      <dt className="font-medium text-foreground">{label}</dt>
      <dd className="space-y-1 text-muted-foreground">
        <a
          className="font-medium text-foreground underline underline-offset-4"
          href={source.sourceUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          {source.label}
        </a>
        <p>{source.notice}</p>
        <p>
          {source.publisher} · {source.version}
        </p>
      </dd>
    </div>
  );
}
