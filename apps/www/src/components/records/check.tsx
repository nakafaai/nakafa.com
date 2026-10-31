import type { Ref } from "@confect/core";
import type records from "@repo/backend/confect/_generated/refs/records";
import { Nina } from "@repo/design-system/components/ui/nina";
import { DateTime } from "effect";
import { useTranslations } from "use-intl";
import { EntryShellBody } from "@/components/entry/shell";

/** The answer of the public check of a report card's or an SKL's hash. */
type CheckAnswer = Ref.Returns<typeof records.checks.report>;

/**
 * The public check of a report card's or an SKL's QR code (ADR 0033, S5 and S6): a locked
 * document shows its school, its kind, its period, and the date it was approved or issued, and
 * nothing about its student. Any other hash reads the same not-found sentence.
 */
export function ReportCheck({ answer }: { answer: CheckAnswer }) {
  const t = useTranslations("ReportCheck");

  if (answer.outcome === "unknown") {
    return (
      <EntryShellBody>
        <Nina act="searching" label="" size={96} whole />
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-xl font-semibold">{t("unknown")}</h1>
          <p className="text-muted-foreground">{t("unknown-description")}</p>
        </div>
      </EntryShellBody>
    );
  }
  return (
    <EntryShellBody>
      <Nina act="waving" label="" size={96} whole />
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-xl font-semibold">{t(`locked-${answer.kind}`)}</h1>
        <p className="text-muted-foreground">
          {t(`locked-${answer.kind}-description`)}
        </p>
      </div>
      <dl className="grid w-full grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">{t("school")}</dt>
        <dd className="text-right font-medium">{answer.school}</dd>
        <dt className="text-muted-foreground">{t("kind")}</dt>
        <dd className="text-right font-medium">{t(`kind-${answer.kind}`)}</dd>
        <dt className="text-muted-foreground">{t("period")}</dt>
        <dd className="text-right font-medium">{answer.period}</dd>
        <dt className="text-muted-foreground">
          {t(answer.kind === "report" ? "approved" : "issued")}
        </dt>
        <dd className="text-right font-medium tabular-nums">
          {DateTime.formatIsoDateUtc(DateTime.makeUnsafe(answer.approvedAt))}
        </dd>
      </dl>
    </EntryShellBody>
  );
}
