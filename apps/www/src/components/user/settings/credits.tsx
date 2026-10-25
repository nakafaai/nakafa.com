import { Coins01Icon } from "@hugeicons/core-free-icons";
import {
  TOP_UP_PACK_CREDITS,
  TOP_UP_VALIDITY_MONTHS,
} from "@repo/backend/confect/credits/constants";
import { Button } from "@repo/design-system/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { Array as Arr } from "effect";
import { useLocale, useTranslations } from "use-intl";
import { CurrencyText } from "@/components/marketing/about/pricing/currency";
import {
  CardSection,
  CardSectionActions,
  CardSectionFooter,
} from "@/components/shared/card/section";
import { useBillingNavigation } from "@/lib/billing/checkout";
import {
  type BillingOverview,
  formatBillingDate,
  formatCount,
} from "@/lib/billing/plan";
import { topUpPriceText } from "@/lib/billing/topup";
import { isActiveLocale } from "@/lib/i18n/active";
import { PricingCurrencySchema } from "@/lib/pricing/monthly";

/**
 * The Nina credits card, for every viewer: the balance, the allowance of the
 * plan, the day the balance refills, and the top-up packs with the day the first
 * of them ends. A Pro viewer buys a pack here, so the purchase never starts on
 * the pricing page.
 */
export function UserSettingsCredits({
  overview,
}: {
  overview: BillingOverview;
}) {
  const billing = useBillingNavigation();
  const locale = useLocale();
  const t = useTranslations("Auth");
  const { credits, plan } = overview;
  const isPro = plan === "pro";
  const { expiresAt } = credits.lots;

  const handleBuy = () => {
    if (!isActiveLocale(locale)) {
      return;
    }

    billing.openTopupCheckout({
      locale,
      source: "settings-topup",
    });
  };

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
          {credits.lots.balance > 0 && expiresAt !== null ? (
            <>
              <dt className="text-muted-foreground">{t("top-up-balance")}</dt>
              <dd>{formatCount(credits.lots.balance, locale)}</dd>
              <dt className="text-muted-foreground">{t("top-up-ends")}</dt>
              <dd>{formatBillingDate(expiresAt, locale)}</dd>
            </>
          ) : null}
        </dl>
      </CardContent>
      {isPro ? (
        <CardSectionFooter hint={<PackPriceSentence />}>
          <CardSectionActions>
            <Button
              disabled={billing.isPending || !isActiveLocale(locale)}
              onClick={handleBuy}
            >
              <Spinner icon={Coins01Icon} isLoading={billing.isPending} />
              {t("buy-credits")}
            </Button>
          </CardSectionActions>
        </CardSectionFooter>
      ) : (
        <CardSectionFooter hint={t("credits-free-footer")} />
      )}
    </CardSection>
  );
}

/** The Pro footer sentence, with one pack's price in each currency: the visitor's currency shows. */
function PackPriceSentence() {
  const t = useTranslations("Auth");

  return (
    <>
      {Arr.map(PricingCurrencySchema.literals, (currency) => (
        <CurrencyText currency={currency} key={currency}>
          {t("credits-pro-footer", {
            credits: TOP_UP_PACK_CREDITS,
            months: TOP_UP_VALIDITY_MONTHS,
            price: topUpPriceText(currency),
          })}
        </CurrencyText>
      ))}
    </>
  );
}
