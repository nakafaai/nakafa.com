import { Coins01Icon } from "@hugeicons/core-free-icons";
import { TOP_UP_PACK_CREDITS } from "@repo/backend/confect/credits/constants";
import { Button } from "@repo/design-system/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { Dashboard } from "@repo/design-system/components/ui/dashboard";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
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
  creditFooterKey,
  creditPeriodKey,
  formatBillingDate,
  formatCount,
  usedPercent,
} from "@/lib/billing/plan";
import { topUpPriceText } from "@/lib/billing/topup";
import { isActiveLocale } from "@/lib/i18n/active";
import { PricingCurrencySchema } from "@/lib/pricing/monthly";

/**
 * The Nina credits card, for every viewer: the share of the period's credits
 * already used as a bar, the day they reset, and the share written beside it, so
 * the card shows how much is left instead of listing it. A screen reader hears
 * the exact count left. Top-up packs show their count left and the day the first
 * of them expires, and a Pro viewer buys a pack here, so the purchase never
 * starts on the pricing page.
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
  // A school member draws from their school's pool instead of their own credits, so the pool's day is what they see.
  const period = credits.pool ?? credits;
  const percent = usedPercent(period);
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
      <CardContent className="grid gap-6">
        <CreditUsage
          period={t(creditPeriodKey(overview))}
          resets={t("credits-resets", {
            date: formatBillingDate(period.resetAt, locale),
          })}
          used={t("credits-used", { percent })}
        >
          <Dashboard.Meter
            label={t("credits-left", {
              left: formatCount(period.balance, locale),
              total: formatCount(period.allowance, locale),
            })}
            percent={percent}
          />
        </CreditUsage>
        {credits.pool === null &&
        credits.lots.balance > 0 &&
        expiresAt !== null ? (
          <CreditUsage
            period={t("top-up-balance")}
            resets={t("top-up-expires", {
              date: formatBillingDate(expiresAt, locale),
            })}
            used={t("top-up-left", { count: credits.lots.balance })}
          />
        ) : null}
      </CardContent>
      {isPro && credits.pool === null ? (
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
        <CardSectionFooter hint={t(creditFooterKey(overview))} />
      )}
    </CardSection>
  );
}

/**
 * One pool of credits: its name and the day it resets or expires, then what is
 * left of it. A period of the plan shows the share used as a bar; a pack has no
 * allowance to measure against, so it shows its count alone. A phone stacks the
 * bar under the names, and a wider card sets it between them and the figure.
 */
function CreditUsage({
  children,
  period,
  resets,
  used,
}: {
  children?: ReactNode;
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
      {children === undefined ? null : (
        <div className="col-span-2 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1">
          {children}
        </div>
      )}
      <p className="col-start-2 row-start-1 text-end text-muted-foreground text-sm tabular-nums sm:col-start-3">
        {used}
      </p>
    </div>
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
            price: topUpPriceText(currency),
          })}
        </CurrencyText>
      ))}
    </>
  );
}
