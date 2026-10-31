import { QueryResult, useAction, useMutation, useQuery } from "@confect/react";
import {
  Diamond02Icon,
  Invoice01Icon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons";
import billing from "@repo/backend/confect/_generated/refs/billing";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import { CardContent } from "@repo/design-system/components/ui/card";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Radio,
  RadioGroup,
} from "@repo/design-system/components/ui/radio-group";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Array as Arr, Option } from "effect";
import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import {
  CardSection,
  CardSectionActions,
  CardSectionFooter,
} from "@/components/shared/card/section";
import { useTenant } from "@/components/tenant/context";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { SchoolInvoicesCard } from "@/components/tenant/settings/invoices";
import { saveSchool } from "@/components/tenant/settings/save";
import { SettingsPage } from "@/components/tenant/settings/section";
import {
  formatBillingDate,
  formatCount,
  formatMinorAmount,
} from "@/lib/billing/plan";
import {
  planHintKey,
  purchaseOf,
  type SchoolBilling,
  type SchoolOffer,
  schoolPayChange,
} from "@/lib/billing/school";
import { isActiveLocale } from "@/lib/i18n/active";

const SOURCE = "components/tenant/settings/billing";

/** The words that name each offer: the term an invoice pays for in Indonesia, or how often Polar seats renew elsewhere. */
const OFFER_LABELS = {
  polar: {
    "school.seat.month": "billing-offer-month",
    "school.seat.semester": "billing-term-semester",
    "school.seat.year": "billing-offer-year",
  },
  xendit: {
    "school.seat.month": "billing-offer-month",
    "school.seat.semester": "billing-term-semester",
    "school.seat.year": "billing-term-year",
  },
} as const satisfies Record<
  SchoolBilling["rail"],
  Record<SchoolBilling["quotes"][number]["offer"], string>
>;

/** The school's billing in the settings frame, whose header shows while its body loads. */
export function SchoolBillingSettings({ slug }: { slug: TenantSlug }) {
  return (
    <SettingsPage>
      <ReadBoundary read={{ args: { slug }, ref: billing.school.overview }}>
        <SchoolBillingBody slug={slug} />
      </ReadBoundary>
    </SettingsPage>
  );
}

/** Reads the school's billing once the viewer's session has settled, then shows its plan and its invoices. */
function SchoolBillingBody({ slug }: { slug: TenantSlug }) {
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const overview = useQuery(
    billing.school.overview,
    isSettled ? { slug } : "skip"
  );

  if (QueryResult.isFailure(overview)) {
    throw overview.error;
  }
  if (!QueryResult.isSuccess(overview)) {
    return null;
  }

  return (
    <>
      <SchoolPlanCard billing={overview.value} />
      <SchoolInvoicesCard billing={overview.value} />
    </>
  );
}

/**
 * The plan of the school: Free up to its limit of students, or School until the day
 * its grant ends, with its students, and the action that pays for the students not
 * paid for yet when there are any.
 */
function SchoolPlanCard({ billing: overview }: { billing: SchoolBilling }) {
  const t = useTranslations("SchoolSettings");
  const locale = useLocale();
  const [isChoosing, setIsChoosing] = useState(false);
  const { plan, quotes, students } = overview;
  const canPay = Arr.isReadonlyArrayNonEmpty(quotes);

  return (
    <CardSection
      description={
        plan.kind === "free"
          ? t("billing-free-description", { limit: plan.limit })
          : t("billing-school-description", {
              date: formatBillingDate(plan.validTo, locale),
            })
      }
      title={
        plan.kind === "free"
          ? t("billing-free-title")
          : t("billing-school-title")
      }
    >
      <CardContent>
        <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-3 text-sm">
          <dt className="text-muted-foreground">{t("billing-students")}</dt>
          <dd>{formatCount(students, locale)}</dd>
          {plan.kind === "free" ? (
            <>
              <dt className="text-muted-foreground">{t("billing-limit")}</dt>
              <dd>{formatCount(plan.limit, locale)}</dd>
            </>
          ) : (
            <>
              <dt className="text-muted-foreground">{t("billing-paid")}</dt>
              <dd>{formatCount(plan.seats, locale)}</dd>
              <dt className="text-muted-foreground">{t("billing-nina")}</dt>
              <dd>
                {t("billing-nina-used", {
                  total: formatCount(plan.nina.capacity, locale),
                  used: formatCount(plan.nina.used, locale),
                })}
              </dd>
            </>
          )}
        </dl>
      </CardContent>
      <CardSectionFooter
        hint={t(planHintKey(overview), {
          limit: plan.kind === "free" ? plan.limit : students,
        })}
      >
        {canPay ? (
          <CardSectionActions>
            <Button onClick={() => setIsChoosing(true)} type="button">
              <HugeIcons
                icon={plan.kind === "free" ? Diamond02Icon : Wallet01Icon}
              />
              {plan.kind === "free" ? t("billing-upgrade") : t("billing-add")}
            </Button>
          </CardSectionActions>
        ) : null}
      </CardSectionFooter>
      {canPay ? (
        <SchoolTermDialog
          billing={overview}
          open={isChoosing}
          setOpen={setIsChoosing}
        />
      ) : null}
    </CardSection>
  );
}

/**
 * Chooses the term the school pays for and issues its invoice. Each term shows the
 * price of one student for the days still to run and the total for the students
 * not paid for yet. The dialog closes as the invoice is asked for, and the invoice
 * shows in the list at once.
 */
function SchoolTermDialog({
  billing: overview,
  open,
  setOpen,
}: {
  billing: SchoolBilling;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const { slug } = useTenant();
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const locale = useLocale();
  const [offer, setOffer] = useState<SchoolOffer | undefined>(undefined);
  const [isPending, startPaying] = useTransition();
  const pay = useMutation(billing.school.pay).withOptimisticUpdate(
    schoolPayChange
  );
  const checkout = useAction(billing.polar.school.checkout);
  const chosen =
    offer ?? Option.getOrUndefined(Arr.head(overview.quotes))?.offer;

  // An Indonesian school issues an invoice, which lists at once; any other school buys Polar seats on Polar's page.
  const submit = () => {
    const purchase =
      chosen === undefined ? null : purchaseOf(overview.rail, chosen);
    if (purchase === null || !isActiveLocale(locale)) {
      return;
    }
    setOpen(false);
    startPaying(() =>
      purchase.kind === "invoice"
        ? saveSchool(() => pay({ offer: purchase.offer, slug }), SOURCE)
        : saveSchool(
            () => checkout({ locale, offer: purchase.offer, slug }),
            SOURCE,
            ({ url }) => {
              window.location.href = url;
            }
          )
    );
  };

  return (
    <ResponsiveDialog
      description={t(
        overview.rail === "xendit"
          ? "billing-dialog-description"
          : "billing-dialog-seats"
      )}
      footer={
        <>
          <Button
            onClick={() => setOpen(false)}
            type="button"
            variant="outline"
          >
            {common("cancel")}
          </Button>
          <Button
            disabled={chosen === undefined || isPending}
            inert={isPending}
            onClick={submit}
            type="button"
          >
            <HugeIcons
              icon={overview.rail === "xendit" ? Invoice01Icon : Wallet01Icon}
            />
            {overview.rail === "xendit"
              ? t("billing-issue")
              : t("billing-checkout")}
          </Button>
        </>
      }
      open={open}
      setOpen={setOpen}
      title={t("billing-dialog-title")}
    >
      <RadioGroup
        aria-label={t("billing-dialog-title")}
        onValueChange={(value) => {
          const quote = Arr.findFirst(
            overview.quotes,
            (candidate) => candidate.offer === value
          );
          setOffer(Option.getOrUndefined(Option.map(quote, (q) => q.offer)));
        }}
        value={chosen ?? ""}
      >
        {Arr.map(overview.quotes, (quote) => (
          <SchoolTermOption
            currency={overview.currency}
            key={quote.offer}
            quote={quote}
            rail={overview.rail}
          />
        ))}
      </RadioGroup>
    </ResponsiveDialog>
  );
}

/**
 * One term the school can pay for: its name and total on one line, and on the
 * next the students it pays for with the day an invoice's term ends, or the
 * price of each renewing Polar seat.
 */
function SchoolTermOption({
  currency,
  quote,
  rail,
}: {
  currency: SchoolBilling["currency"];
  quote: SchoolBilling["quotes"][number];
  rail: SchoolBilling["rail"];
}) {
  const t = useTranslations("SchoolSettings");
  const locale = useLocale();

  return (
    <label className="has-data-checked:border-primary flex cursor-pointer items-start gap-3 rounded-lg border p-4">
      <Radio className="mt-0.5" value={quote.offer} />
      <span className="grid flex-1 gap-1">
        <span className="flex items-baseline justify-between gap-3 text-sm font-medium">
          <span>{t(OFFER_LABELS[rail][quote.offer])}</span>
          <span className="whitespace-nowrap tabular-nums">
            {formatMinorAmount(quote.total, currency)}
          </span>
        </span>
        <span className="text-muted-foreground text-sm">
          {rail === "xendit"
            ? t("billing-quote-term", {
                date: formatBillingDate(quote.periodEnd - 1, locale),
                seats: quote.seats,
              })
            : t("billing-quote-seats", {
                price: formatMinorAmount(quote.unitAmount, currency),
                seats: quote.seats,
              })}
        </span>
      </span>
    </label>
  );
}
