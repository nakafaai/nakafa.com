import type { Ref } from "@confect/core";
import type records from "@repo/backend/confect/_generated/refs/records";
import { Nina } from "@repo/design-system/components/ui/nina";
import { DateTime } from "effect";
import { useTranslations } from "use-intl";
import { EntryShellBody } from "@/components/entry/shell";

/** The answer of the public check of a report card's hash. */
type CheckAnswer = Ref.Returns<typeof records.checks.report>;

/**
 * The public check of a report card's QR code (ADR 0033, S5): a locked report shows its
 * school, the kind of document, its period, and its approval date, and nothing about its
 * student. Any other hash reads the same not-found sentence.
 */
export function ReportCheck({ answer }: { answer: CheckAnswer }) {
  const t = useTranslations("ReportCheck");

  if (answer.outcome === "unknown") {
    return (
      <EntryShellBody>
        <Nina act="searching" label="" size={96} whole />
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="font-semibold text-xl">{t("unknown")}</h1>
          <p className="text-muted-foreground">{t("unknown-description")}</p>
        </div>
      </EntryShellBody>
    );
  }
  return (
    <EntryShellBody>
      <Nina act="waving" label="" size={96} whole />
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="font-semibold text-xl">{t("locked")}</h1>
        <p className="text-muted-foreground">{t("locked-description")}</p>
      </div>
      <dl className="grid w-full grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">{t("school")}</dt>
        <dd className="text-right font-medium">{answer.school}</dd>
        <dt className="text-muted-foreground">{t("kind")}</dt>
        <dd className="text-right font-medium">{t("kind-report")}</dd>
        <dt className="text-muted-foreground">{t("period")}</dt>
        <dd className="text-right font-medium">{answer.period}</dd>
        <dt className="text-muted-foreground">{t("approved")}</dt>
        <dd className="text-right font-medium tabular-nums">
          {DateTime.formatIsoDateUtc(DateTime.makeUnsafe(answer.approvedAt))}
        </dd>
      </dl>
    </EntryShellBody>
  );
}
