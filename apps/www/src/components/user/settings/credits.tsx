import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { Dashboard } from "@repo/design-system/components/ui/dashboard";
import { useLocale, useTranslations } from "use-intl";
import {
  CardSection,
  CardSectionFooter,
} from "@/components/shared/card/section";
import {
  type BillingOverview,
  formatBillingDate,
  formatCount,
  usedPercent,
} from "@/lib/billing/plan";

/**
 * The Nina credits card, for every viewer: the share of the period's credits
 * already used as a bar, the day they reset, and the share written beside it, so
 * the card shows how much is left instead of listing it. A screen reader hears
 * the exact count left. Pro's footer has no action yet.
 */
export function UserSettingsCredits({
  overview,
}: {
  overview: BillingOverview;
}) {
  const locale = useLocale();
  const t = useTranslations("Auth");
  const { credits, plan } = overview;
  const isPro = plan === "pro";
  const percent = usedPercent(credits);

  return (
    <CardSection>
      <CardHeader>
        <CardTitle>{t("credits")}</CardTitle>
        <CardDescription>{t("credits-description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <CreditUsage
          meter={t("credits-left", {
            left: formatCount(credits.balance, locale),
            total: formatCount(credits.allowance, locale),
          })}
          percent={percent}
          period={t(isPro ? "credits-month" : "credits-today")}
          resets={t("credits-resets", {
            date: formatBillingDate(credits.resetAt, locale),
          })}
          used={t("credits-used", { percent })}
        />
      </CardContent>
      <CardSectionFooter
        hint={t(isPro ? "credits-pro-footer" : "credits-free-footer")}
      />
    </CardSection>
  );
}

/**
 * One period of credits: its name and its reset day, the bar of the share used,
 * and that share in words. A phone stacks the bar under the names, and a wider
 * card sets the bar between them and the share.
 */
function CreditUsage({
  meter,
  percent,
  period,
  resets,
  used,
}: {
  meter: string;
  percent: number;
  period: string;
  resets: string;
  used: string;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto]">
      <div className="col-start-1 row-start-1 grid gap-0.5">
        <p className="font-medium text-sm">{period}</p>
        <p className="text-muted-foreground text-sm">{resets}</p>
      </div>
      <div className="col-span-2 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1">
        <Dashboard.Meter label={meter} percent={percent} />
      </div>
      <p className="col-start-2 row-start-1 text-end text-muted-foreground text-sm tabular-nums sm:col-start-3">
        {used}
      </p>
    </div>
  );
}
