import type { BillingCurrency } from "@repo/backend/confect/billing/catalog";
import {
  SchoolPaidTierKey,
  SchoolPeriod,
  schoolAccount,
  schoolMonthlyAfterDiscount,
  schoolPeriodDiscounts,
  schoolQuote,
} from "@repo/backend/confect/billing/tiers";
import { Label } from "@repo/design-system/components/ui/label";
import { Nina } from "@repo/design-system/components/ui/nina";
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
import { formatBytes } from "@repo/internationalization/src/formats";
import { Array as Arr, Option, Record as Rec } from "effect";
import { type ReactNode, useId, useState } from "react";
import { useFormatter, useLocale, useTranslations } from "use-intl";
import { SchoolAmount } from "@/components/marketing/school/pricing/price";
import {
  FeatureCard,
  FeatureLead,
  FeatureRow,
  FeatureText,
  FeatureTitle,
} from "@/components/marketing/shared/feature";

/** The fewest accounts a school adds, and the shortcuts that add more at once. */
const FEWEST_ADDED = 1;
const ADDED_PRESETS = [1, 10, 50, 100] as const;

/** One result of the calculator: its name and its value, a direct group of the results list. */
function CalculatorFigure({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div className="grid content-start gap-1">
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

/** Reads a toggle's value back as a period, or none for an emptied group. */
function readPeriod(value: string) {
  return Arr.findFirst(
    SchoolPeriod.literals,
    (period) => String(period) === value
  );
}

/**
 * The custom account calculator, in the row of a landing: Nina counting beside
 * its title, and the calculator itself. A paid plan, a billing period, and any
 * whole number of accounts from one, with shortcuts that add 1, 10, 50 or 100;
 * then what the plan holds and costs a month in the visitor's currency, and the
 * invoice of a longer period with its discount. Every control of the calculator
 * is as tall as the next.
 */
export function SchoolCalculator() {
  const t = useTranslations("SchoolSite");
  const locale = useLocale();
  const format = useFormatter();
  const inputId = useId();
  const [tier, setTier] = useState<SchoolPaidTierKey>("pro");
  const [period, setPeriod] = useState<SchoolPeriod>(1);
  const [added, setAdded] = useState(FEWEST_ADDED);
  const quote = (currency: BillingCurrency) =>
    schoolQuote({ added, currency, period, tier });
  const idr = quote("IDR");
  const discount = schoolPeriodDiscounts[period];

  return (
    <FeatureRow id="accounts">
      <FeatureText>
        <span className="inline-block">
          <Nina act="counting" label="" size={88} whole />
        </span>
        <FeatureTitle>{t("calculator-title")}</FeatureTitle>
        <FeatureLead>
          {t("calculator-lead", {
            credits: schoolAccount.credits,
            size: formatBytes(
              schoolAccount.storageMegabytes * 1_000_000,
              locale
            ),
          })}
        </FeatureLead>
      </FeatureText>
      <FeatureCard>
        <div className="grid gap-6">
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
            <span className="text-sm font-medium" id={`${inputId}-period`}>
              {t("period-label")}
            </span>
            <ToggleGroup
              aria-labelledby={`${inputId}-period`}
              gridColumns="4"
              layout="grid"
              onValueChange={(value) =>
                Option.map(readPeriod(value), setPeriod)
              }
              value={String(period)}
            >
              {Arr.map(SchoolPeriod.literals, (option) => (
                <ToggleGroupItem key={option} value={String(option)}>
                  {t("period-option", { months: option })}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={inputId}>{t("calculator-added")}</Label>
            <div className="flex flex-wrap gap-2">
              <NumberField
                className="w-40"
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
                <NumberFieldGroup>
                  <NumberFieldDecrement />
                  <NumberFieldInput />
                  <NumberFieldIncrement />
                </NumberFieldGroup>
              </NumberField>
              {Arr.map(ADDED_PRESETS, (preset) => (
                <button
                  aria-label={t("calculator-preset", { count: preset })}
                  className={buttonVariants({ variant: "outline" })}
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
        <dl
          aria-live="polite"
          className="bg-muted/50 grid grid-cols-2 gap-6 rounded-lg p-4"
        >
          <CalculatorFigure label={t("calculator-accounts")}>
            {format.number(idr.accounts)}
          </CalculatorFigure>
          <CalculatorFigure label={t("calculator-credits")}>
            {format.number(idr.credits)}
          </CalculatorFigure>
          <CalculatorFigure label={t("calculator-storage")}>
            {formatBytes(idr.storageMegabytes * 1_000_000, locale)}
          </CalculatorFigure>
          <CalculatorFigure label={t("calculator-monthly")}>
            <SchoolAmount
              amounts={{
                EUR: quote("EUR").monthlyAfterDiscount,
                IDR: idr.monthlyAfterDiscount,
                MYR: quote("MYR").monthlyAfterDiscount,
                USD: quote("USD").monthlyAfterDiscount,
              }}
            />
          </CalculatorFigure>
          {period > 1 ? (
            <CalculatorFigure label={t("calculator-total", { months: period })}>
              <SchoolAmount
                amounts={{
                  EUR: quote("EUR").total,
                  IDR: idr.total,
                  MYR: quote("MYR").total,
                  USD: quote("USD").total,
                }}
              />
              {discount > 0 ? (
                <span className="text-muted-foreground ms-2 text-sm font-normal tracking-normal">
                  {t("calculator-saving", { percent: discount })}
                </span>
              ) : null}
            </CalculatorFigure>
          ) : null}
        </dl>
        <p className="text-muted-foreground text-sm tabular-nums">
          <SchoolAmount
            amounts={Rec.map(schoolAccount.monthly, (amount) =>
              schoolMonthlyAfterDiscount(amount, period)
            )}
          />{" "}
          {t("calculator-unit")}
        </p>
      </FeatureCard>
    </FeatureRow>
  );
}
