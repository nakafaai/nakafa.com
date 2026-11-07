import type { BillingCurrency } from "@repo/backend/confect/billing/catalog";
import {
  SchoolPaidTierKey,
  schoolAccount,
  schoolMonthlyAfterDiscount,
  schoolQuote,
} from "@repo/backend/confect/billing/tiers";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@repo/design-system/components/ui/card";
import { Label } from "@repo/design-system/components/ui/label";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@repo/design-system/components/ui/number";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import { buttonVariants } from "@repo/design-system/lib/button";
import { cva } from "class-variance-authority";
import { Array as Arr, Option, Record as Rec } from "effect";
import { type ReactNode, useId, useState } from "react";
import { useFormatter, useLocale, useTranslations } from "use-intl";
import { useSchoolPeriod } from "@/components/marketing/school/period";
import { SchoolAmount } from "@/components/marketing/school/price";
import { formatStorage } from "@/lib/pricing/school";

/** The fewest accounts a school adds, and the shortcuts that add more at once. */
const FEWEST_ADDED = 1;
const ADDED_PRESETS = [1, 10, 50, 100] as const;

/** The width of one result: the period's invoice takes both columns. */
const resultVariants = cva("grid gap-1", {
  variants: {
    wide: {
      false: "",
      true: "col-span-2",
    },
  },
});

/** One result of the calculator: its name and its value, a direct group of the results list. */
function Result({
  children,
  label,
  wide = false,
}: {
  children: ReactNode;
  label: string;
  wide?: boolean;
}) {
  return (
    <div className={resultVariants({ wide })}>
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="text-xl font-medium tracking-tight tabular-nums">
        {children}
      </dd>
    </div>
  );
}

/** Reads a toggle's value back as a paid plan, or none for an emptied group. */
function readTier(value: string) {
  return Arr.findFirst(SchoolPaidTierKey.literals, (tier) => tier === value);
}

/**
 * The custom account calculator: a paid plan, any whole number of accounts from
 * one, with shortcuts that add 1, 10, 50 or 100, and what the plan then holds
 * and costs for the page's billing period, in the visitor's currency.
 */
export function SchoolCalculator() {
  const t = useTranslations("SchoolSite");
  const locale = useLocale();
  const format = useFormatter();
  const inputId = useId();
  const period = useSchoolPeriod((state) => state.period);
  const [tier, setTier] = useState<SchoolPaidTierKey>("pro");
  const [added, setAdded] = useState(FEWEST_ADDED);
  const quote = (currency: BillingCurrency) =>
    schoolQuote({ added, currency, period, tier });
  const idr = quote("IDR");

  return (
    <Card data-school-calculator="">
      <CardHeader>
        <h2
          className="text-2xl tracking-tight text-balance"
          id="school-calculator-title"
        >
          {t("calculator-title")}
        </h2>
        <p className="text-muted-foreground text-pretty">
          {t("calculator-lead", {
            credits: schoolAccount.credits,
            size: formatStorage(schoolAccount.storageMegabytes, locale),
          })}
        </p>
      </CardHeader>
      <CardContent className="grid gap-8 lg:grid-cols-2">
        <div className="grid content-start gap-6">
          <div className="grid gap-2">
            <span className="text-sm font-medium" id={`${inputId}-plan`}>
              {t("calculator-plan")}
            </span>
            <ToggleGroup
              aria-labelledby={`${inputId}-plan`}
              onValueChange={(value) => Option.map(readTier(value), setTier)}
              value={tier}
            >
              {Arr.map(SchoolPaidTierKey.literals, (option) => (
                <ToggleGroupItem key={option} value={option}>
                  {t(`plan-${option}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={inputId}>{t("calculator-added")}</Label>
            <NumberField
              id={inputId}
              min={FEWEST_ADDED}
              onValueChange={(value) =>
                setAdded(
                  Math.max(FEWEST_ADDED, Math.trunc(value ?? FEWEST_ADDED))
                )
              }
              step={1}
              value={added}
            >
              <NumberFieldGroup className="max-w-48">
                <NumberFieldDecrement />
                <NumberFieldInput />
                <NumberFieldIncrement />
              </NumberFieldGroup>
            </NumberField>
            <div className="flex flex-wrap gap-2">
              {Arr.map(ADDED_PRESETS, (preset) => (
                <button
                  aria-label={t("calculator-preset", { count: preset })}
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                  key={preset}
                  onClick={() => setAdded((current) => current + preset)}
                  type="button"
                >
                  +{preset}
                </button>
              ))}
            </div>
          </div>
        </div>
        <dl aria-live="polite" className="grid grid-cols-2 content-start gap-6">
          <Result label={t("calculator-accounts")}>
            {format.number(idr.accounts)}
          </Result>
          <Result label={t("calculator-credits")}>
            {format.number(idr.credits)}
          </Result>
          <Result label={t("calculator-storage")}>
            {formatStorage(idr.storageMegabytes, locale)}
          </Result>
          <Result label={t("calculator-monthly")}>
            <SchoolAmount
              amounts={{
                EUR: quote("EUR").monthlyAfterDiscount,
                IDR: idr.monthlyAfterDiscount,
                USD: quote("USD").monthlyAfterDiscount,
              }}
            />
          </Result>
          <Result label={t("calculator-total", { months: period })} wide>
            <SchoolAmount
              amounts={{
                EUR: quote("EUR").total,
                IDR: idr.total,
                USD: quote("USD").total,
              }}
            />
          </Result>
        </dl>
      </CardContent>
      <CardFooter>
        <p className="text-muted-foreground text-sm tabular-nums">
          <SchoolAmount
            amounts={Rec.map(schoolAccount.monthly, (amount) =>
              schoolMonthlyAfterDiscount(amount, period)
            )}
          />{" "}
          {t("calculator-unit")}
        </p>
      </CardFooter>
    </Card>
  );
}
