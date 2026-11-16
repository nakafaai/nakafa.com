import { useMutation } from "@confect/react";
import { Calendar03Icon, Invoice01Icon } from "@hugeicons/core-free-icons";
import billing from "@repo/backend/confect/_generated/refs/billing";
import {
  type PlanPeriod,
  remainingShare,
  SCHOOL_ACCOUNT_LIMIT,
  SCHOOL_ACCOUNT_PRESETS,
  SchoolLineKey,
  type SchoolOrder,
} from "@repo/backend/confect/billing/quote";
import {
  SchoolPaidTierKey,
  SchoolPeriod,
  schoolAccount,
  schoolPeriodDiscounts,
  schoolTiers,
} from "@repo/backend/confect/billing/tiers";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@repo/design-system/components/ui/number";
import {
  Radio,
  RadioGroup,
} from "@repo/design-system/components/ui/radio-group";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Array as Arr, DateTime, Option, Schema } from "effect";
import { useId, useState, useTransition } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { useTenant } from "@/components/tenant/context";
import { SelectField } from "@/components/tenant/settings/select";
import { runSchoolWrite, schoolCall } from "@/components/tenant/write";
import { formatMinorAmount } from "@/lib/billing/plan";
import {
  orderQuote,
  type SchoolBilling,
  schoolPayChange,
} from "@/lib/billing/school";

const isMonths = Schema.is(SchoolPeriod);

/**
 * Orders a plan or more accounts and issues its invoice. A plan order chooses Pro or
 * Max, the months it runs and the accounts added to it; a more-accounts order chooses
 * how many. Either shows every line and the total before tax as the server will issue
 * it. The dialog closes as the invoice is asked for, and the invoice lists at once.
 */
export function SchoolOrderDialog({
  billing: overview,
  kind,
  open,
  setOpen,
}: {
  billing: SchoolBilling;
  kind: SchoolOrder["kind"];
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const format = useFormatter();
  const id = useId();
  const { slug } = useTenant();
  const current = overview.plan.kind === "max" ? "max" : "pro";
  const [plan, setPlan] = useState<SchoolPaidTierKey>(current);
  const [months, setMonths] = useState<SchoolPeriod>(12);
  const [accounts, setAccounts] = useState(kind === "plan" ? 0 : 1);
  const [isPending, startPaying] = useTransition();
  const pay = useMutation(billing.school.pay).withOptimisticUpdate(
    schoolPayChange
  );
  const order: SchoolOrder =
    kind === "plan"
      ? { kind, accounts, months, plan }
      : { kind, accounts: Math.max(accounts, 1) };
  const now = DateTime.toEpochMillis(DateTime.nowUnsafe());
  const draft = orderQuote(overview, order, now);

  const submit = () => {
    setOpen(false);
    startPaying(() => runSchoolWrite(schoolCall(() => pay({ order, slug }))));
  };

  return (
    <ResponsiveDialog
      action={
        <Button
          disabled={Option.isNone(draft) || isPending}
          inert={isPending}
          onClick={submit}
          type="button"
        >
          <HugeIcons icon={Invoice01Icon} />
          {t("billing-issue")}
        </Button>
      }
      description={
        kind === "plan"
          ? t("billing-order-description")
          : t("billing-more-description", {
              credits: schoolAccount.credits,
              drive: schoolAccount.storageMegabytes,
            })
      }
      open={open}
      setOpen={setOpen}
      title={t(kind === "plan" ? "billing-order-title" : "billing-more-title")}
    >
      <FieldGroup>
        {kind === "plan" ? (
          <Field>
            <RadioGroup
              aria-label={common("plan")}
              onValueChange={(value) => {
                if (Schema.is(SchoolPaidTierKey)(value)) {
                  setPlan(value);
                }
              }}
              value={plan}
            >
              {Arr.map(SchoolPaidTierKey.literals, (each) => (
                <SchoolPlanOption
                  currency={overview.currency}
                  key={each}
                  plan={each}
                />
              ))}
            </RadioGroup>
          </Field>
        ) : null}
        {kind === "plan" ? (
          <SelectField
            items={Arr.map(SchoolPeriod.literals, (each) => ({
              icon: Calendar03Icon,
              label: t("billing-months", {
                discount: schoolPeriodDiscounts[each],
                months: each,
              }),
              value: String(each),
            }))}
            label={t("invoice-term")}
            menu={common("menu-period")}
            onChoose={(value) => {
              const chosen = Number(value);
              if (isMonths(chosen)) {
                setMonths(chosen);
              }
            }}
            value={String(months)}
          />
        ) : null}
        <Field>
          <FieldLabel htmlFor={`${id}-accounts`}>
            {t(
              kind === "plan"
                ? "billing-order-accounts"
                : "billing-more-accounts"
            )}
          </FieldLabel>
          <div className="flex flex-wrap items-center gap-2">
            <NumberField
              className="w-40"
              id={`${id}-accounts`}
              max={SCHOOL_ACCOUNT_LIMIT}
              min={kind === "plan" ? 0 : 1}
              onValueChange={(value) => setAccounts(value ?? 0)}
              value={accounts}
            >
              <NumberFieldGroup>
                <NumberFieldDecrement />
                <NumberFieldInput />
                <NumberFieldIncrement />
              </NumberFieldGroup>
            </NumberField>
            <ButtonGroup aria-label={t("billing-order-presets")}>
              {Arr.map(SCHOOL_ACCOUNT_PRESETS, (preset) => (
                <Button
                  key={preset}
                  onClick={() =>
                    setAccounts(
                      Math.min(accounts + preset, SCHOOL_ACCOUNT_LIMIT)
                    )
                  }
                  type="button"
                >
                  {`+${format.number(preset)}`}
                </Button>
              ))}
            </ButtonGroup>
          </div>
        </Field>
        {Option.match(draft, {
          onNone: () => null,
          onSome: (priced) => (
            <SchoolOrderSummary
              currency={overview.currency}
              kind={kind}
              period={priced.period}
              quote={priced.quote}
            />
          ),
        })}
      </FieldGroup>
    </ResponsiveDialog>
  );
}

/** One paid plan to choose: its name and monthly price, then the accounts, AI credits and Drive it holds. */
function SchoolPlanOption({
  currency,
  plan,
}: {
  currency: SchoolBilling["currency"];
  plan: SchoolPaidTierKey;
}) {
  const t = useTranslations("SchoolSettings");
  const format = useFormatter();

  return (
    <label className="has-data-checked:border-primary flex cursor-pointer items-start gap-3 rounded-lg border p-4">
      <Radio className="mt-0.5" value={plan} />
      <span className="grid flex-1 gap-1">
        <span className="flex items-baseline justify-between gap-3 text-sm font-medium">
          <span>{t(`billing-plan.${plan}`)}</span>
          <span className="whitespace-nowrap tabular-nums">
            {t("billing-per-month", {
              price: formatMinorAmount(
                schoolTiers[plan].monthly[currency],
                currency
              ),
            })}
          </span>
        </span>
        <span className="text-muted-foreground text-sm text-pretty">
          {t("billing-plan-holds", {
            accounts: format.number(schoolTiers[plan].accounts),
            credits: format.number(schoolTiers[plan].credits),
            drive: schoolTiers[plan].storageMegabytes / 1000,
          })}
        </span>
      </span>
    </label>
  );
}

/** The words of each line of a plan order. More accounts on a running plan read as a prorated line. */
const LINE_LABELS = {
  "school.accounts": "billing-line-accounts",
  "school.max": "billing-line-max",
  "school.pro": "billing-line-pro",
} as const satisfies Record<SchoolLineKey, string>;

const isSchoolLine = Schema.is(SchoolLineKey);

/** Every line of an order, its total before tax, and the days it runs. */
function SchoolOrderSummary({
  currency,
  kind,
  period,
  quote,
}: {
  currency: SchoolBilling["currency"];
  kind: SchoolOrder["kind"];
  period: typeof PlanPeriod.Type;
  quote: Option.Option.Value<ReturnType<typeof orderQuote>>["quote"];
}) {
  const t = useTranslations("SchoolSettings");
  const format = useFormatter();
  const { days } = remainingShare(period, period.start);

  return (
    <dl className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-2 rounded-lg border p-4 text-sm">
      {Arr.map(quote.lines, (line) => (
        <SchoolOrderLine
          amount={formatMinorAmount(line.amount, currency)}
          key={line.description}
          label={t(
            kind === "accounts" || !isSchoolLine(line.description)
              ? "billing-line-prorata"
              : LINE_LABELS[line.description],
            {
              accounts: format.number(line.quantity),
              days,
              months: period.months,
            }
          )}
        />
      ))}
      <dt className="font-medium">{t("billing-total")}</dt>
      <dd className="font-medium whitespace-nowrap tabular-nums">
        {formatMinorAmount(quote.total, currency)}
      </dd>
      <dd className="text-muted-foreground col-span-2 text-pretty">
        {t(kind === "accounts" ? "billing-runs-more" : "billing-runs", {
          end: format.dateTime(period.end - 1, "billing"),
          start: format.dateTime(period.start, "billing"),
        })}
      </dd>
    </dl>
  );
}

/** One line of an order and its amount. */
function SchoolOrderLine({ amount, label }: { amount: string; label: string }) {
  return (
    <>
      <dt className="text-muted-foreground text-pretty">{label}</dt>
      <dd className="whitespace-nowrap tabular-nums">{amount}</dd>
    </>
  );
}
