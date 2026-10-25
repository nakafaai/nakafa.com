import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { useLocale, useTranslations } from "use-intl";
import {
  CardSection,
  CardSectionFooter,
} from "@/components/shared/card/section";
import {
  type BillingOverview,
  formatBillingDate,
  formatCount,
} from "@/lib/billing/plan";

/**
 * The Nina credits card, for every viewer: the balance, the allowance of the
 * plan, and the day the balance refills. Pro's footer has no action yet.
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

  return (
    <CardSection>
      <CardHeader>
        <CardTitle>{t("credits")}</CardTitle>
        <CardDescription>{t("credits-description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-6 gap-y-3 text-sm">
          <dt className="text-muted-foreground">{t("balance")}</dt>
          <dd>{formatCount(credits.balance, locale)}</dd>
          <dt className="text-muted-foreground">{t("allowance")}</dt>
          <dd>
            {t(isPro ? "allowance-monthly" : "allowance-daily", {
              amount: credits.allowance,
            })}
          </dd>
          <dt className="text-muted-foreground">{t("next-reset")}</dt>
          <dd>{formatBillingDate(credits.resetAt, locale)}</dd>
        </dl>
      </CardContent>
      <CardSectionFooter
        hint={t(isPro ? "credits-pro-footer" : "credits-free-footer")}
      />
    </CardSection>
  );
}
