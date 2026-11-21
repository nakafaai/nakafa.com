import type { BillingCurrency } from "@repo/backend/confect/billing/catalog";
import {
  SchoolPaidTierKey,
  SchoolPeriod,
  schoolAccount,
  schoolMonthlyAfterDiscount,
  schoolPeriodDiscounts,
  schoolQuote,
} from "@repo/backend/confect/billing/tiers";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { Card, CardContent } from "@repo/design-system/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import { useMissedPress } from "@repo/design-system/hooks/press";
import { formatBytes } from "@repo/internationalization/src/formats";
import { cn } from "cn";
import { Array as Arr, Option, Record as Rec } from "effect";
import type { ReactNode } from "react";
import { useId, useState } from "react";
import { useFormatter, useLocale, useTranslations } from "use-intl";
import { SchoolAmount } from "@/components/marketing/school/pricing/price";
import {
  FeatureLead,
  FeatureProduct,
  FeatureRow,
  FeatureText,
  FeatureTitle,
} from "@/components/marketing/shared/feature";

const FEWEST_ADDED = 1;
const ADDED_PRESETS = [10, 50, 100] as const;

/** A secondary part of the quote, with the value aligned to the end of the same line. */
function CalculatorFigure({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 px-(--card-spacing) py-1",
        className
      )}
    >
      <dt className="text-muted-foreground text-sm wrap-anywhere">{label}</dt>
      <dd className="max-w-40 text-end font-mono text-sm font-medium wrap-anywhere tabular-nums">
        {children}
      </dd>
    </div>
  );
}

/** Picks a billing cadence in the same space at every width and locale. */
function CalculatorPeriod({
  period,
  setPeriod,
}: {
  period: SchoolPeriod;
  setPeriod: (period: SchoolPeriod) => void;
}) {
  const t = useTranslations("SchoolSite");
  const common = useTranslations("Common");
  const labelId = useId();
  const [open, setOpen] = useState(false);
  const press = useMissedPress<HTMLButtonElement>(() => setOpen(true));

  return (
    <div className="row-span-2 grid min-w-0 grid-rows-subgrid">
      <span className="self-end font-medium wrap-anywhere" id={labelId}>
        {t("period-label")}
      </span>
      <Select
        onOpenChange={setOpen}
        onValueChange={(value) =>
          Option.map(
            Arr.findFirst(
              SchoolPeriod.literals,
              (option) => String(option) === value
            ),
            setPeriod
          )
        }
        open={open}
        value={String(period)}
      >
        <SelectTrigger
          aria-labelledby={labelId}
          className="w-full gap-1 px-2.5"
          {...press}
        >
          <SelectValue>{t("period-option", { months: period })}</SelectValue>
        </SelectTrigger>
        <SelectContent
          align="end"
          alignItemWithTrigger={false}
          label={common("menu-period")}
        >
          {Arr.map(SchoolPeriod.literals, (option) => (
            <SelectItem key={option} plain value={String(option)}>
              {t("period-option", { months: option })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Configures a School quote and puts the billed amount before the plan's capacity. */
export function SchoolCalculator() {
  const t = useTranslations("SchoolSite");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const format = useFormatter();
  const inputId = useId();
  const [tier, setTier] = useState<SchoolPaidTierKey>("pro");
  const [period, setPeriod] = useState<SchoolPeriod>(1);
  const [added, setAdded] = useState(FEWEST_ADDED);
  const quote = (currency: BillingCurrency) =>
    schoolQuote({ added, currency, period, tier });
  const idr = quote("IDR");
  const eur = quote("EUR");
  const myr = quote("MYR");
  const usd = quote("USD");
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
      <FeatureProduct>
        <Card
          className="@container/calculator min-w-0 gap-0 py-0"
          data-school-calculator=""
        >
          <CardContent className="grid gap-4 py-(--card-spacing)">
            <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-x-3 gap-y-2">
              <div className="row-span-2 grid min-w-0 grid-rows-subgrid">
                <span className="self-end font-medium" id={`${inputId}-plan`}>
                  {tCommon("plan")}
                </span>
                <ToggleGroup
                  aria-labelledby={`${inputId}-plan`}
                  gridColumns="2"
                  layout="grid"
                  onValueChange={(value) =>
                    Option.map(
                      Arr.findFirst(
                        SchoolPaidTierKey.literals,
                        (option) => option === value
                      ),
                      setTier
                    )
                  }
                  value={tier}
                >
                  {Arr.map(SchoolPaidTierKey.literals, (option) => (
                    <ToggleGroupItem
                      className="min-w-0 px-1.5"
                      key={option}
                      value={option}
                    >
                      {t(`plan.${option}`)}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
              <CalculatorPeriod period={period} setPeriod={setPeriod} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={inputId}>{t("calculator-added")}</Label>
              <div className="grid gap-2 @lg/calculator:grid-cols-2">
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
                  <NumberFieldGroup>
                    <NumberFieldInput />
                    <NumberFieldDecrement />
                    <NumberFieldIncrement />
                  </NumberFieldGroup>
                </NumberField>
                <ButtonGroup className="grid w-full grid-cols-3">
                  {Arr.map(ADDED_PRESETS, (preset) => (
                    <Button
                      aria-label={t("calculator-preset", { count: preset })}
                      className="min-w-0 px-2 tabular-nums"
                      key={preset}
                      onClick={() => setAdded((current) => current + preset)}
                      type="button"
                    >
                      +{preset}
                    </Button>
                  ))}
                </ButtonGroup>
              </div>
            </div>
          </CardContent>
          <dl aria-live="polite">
            <div className="bg-muted/30 grid gap-1 border-t px-(--card-spacing) pt-4">
              <dt className="text-muted-foreground flex items-baseline justify-between gap-2 text-sm">
                {t("calculator-total", { months: period })}
                {discount > 0 ? (
                  <span className="text-success shrink-0 text-xs font-medium">
                    {t("calculator-saving", { percent: discount })}
                  </span>
                ) : null}
              </dt>
              <dd className="font-mono text-2xl leading-tight font-medium wrap-anywhere tabular-nums">
                <SchoolAmount
                  amounts={{
                    EUR: eur.total,
                    IDR: idr.total,
                    MYR: myr.total,
                    USD: usd.total,
                  }}
                />
              </dd>
            </div>
            <CalculatorFigure
              className="bg-muted/30 pt-3"
              label={t("calculator-monthly")}
            >
              <SchoolAmount
                amounts={{
                  EUR: eur.monthlyAfterDiscount,
                  IDR: idr.monthlyAfterDiscount,
                  MYR: myr.monthlyAfterDiscount,
                  USD: usd.monthlyAfterDiscount,
                }}
              />
            </CalculatorFigure>
            <CalculatorFigure
              className="bg-muted/30 pb-4"
              label={t("calculator-unit-label")}
            >
              <SchoolAmount
                amounts={Rec.map(schoolAccount.monthly, (amount) =>
                  schoolMonthlyAfterDiscount(amount, period)
                )}
              />
            </CalculatorFigure>
            <CalculatorFigure className="pt-4" label={tCommon("accounts")}>
              {format.number(idr.accounts)}
            </CalculatorFigure>
            <CalculatorFigure label={t("calculator-credits")}>
              {format.number(idr.credits)}
            </CalculatorFigure>
            <CalculatorFigure className="pb-4" label={t("calculator-storage")}>
              {formatBytes(idr.storageMegabytes * 1_000_000, locale)}
            </CalculatorFigure>
          </dl>
        </Card>
      </FeatureProduct>
    </FeatureRow>
  );
}
