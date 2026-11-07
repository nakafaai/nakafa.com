import { QueryResult, useQuery } from "@confect/react";
import {
  CreditCardIcon,
  Diamond02Icon,
  Mail01Icon,
  UserAdd01Icon,
} from "@hugeicons/core-free-icons";
import billing from "@repo/backend/confect/_generated/refs/billing";
import { schoolTiers } from "@repo/backend/confect/billing/tiers";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import { CardContent } from "@repo/design-system/components/ui/card";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Meter } from "@repo/design-system/components/ui/meter";
import { DateTime, Option } from "effect";
import { useState } from "react";
import { useLocale, useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import {
  CardSection,
  CardSectionActions,
  CardSectionFooter,
} from "@/components/shared/card/section";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { SchoolInvoicesCard } from "@/components/tenant/settings/invoices";
import { SchoolOrderDialog } from "@/components/tenant/settings/order";
import { SettingsPage } from "@/components/tenant/settings/section";
import { formatBillingDate, formatCount } from "@/lib/billing/plan";
import {
  openInvoice,
  paidPlan,
  type SchoolBilling,
  transferMailto,
} from "@/lib/billing/school";

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

/** Reads the school's billing once the viewer's session has settled, then shows its plan, its accounts and its invoices. */
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
      <SchoolAccountsCard billing={overview.value} />
      <SchoolInvoicesCard billing={overview.value} />
    </>
  );
}

/** A whole number of bytes as gigabytes or megabytes in the words of one locale. */
function formatDrive(bytes: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    style: "unit",
    unit: bytes >= 1_000_000_000 ? "gigabyte" : "megabyte",
  }).format(bytes >= 1_000_000_000 ? bytes / 1_000_000_000 : bytes / 1_000_000);
}

/**
 * The plan of the school: the trial until its last day, Pro or Max over its period, or
 * a contract, with its shared AI credits and Drive. Its one action pays the open
 * invoice while one waits, and otherwise orders a plan: the first one after the trial,
 * or the next period of the plan that runs.
 */
function SchoolPlanCard({ billing: overview }: { billing: SchoolBilling }) {
  const t = useTranslations("SchoolSettings");
  const locale = useLocale();
  const [isOrdering, setIsOrdering] = useState(false);
  const { plan } = overview;
  const now = DateTime.toEpochMillis(DateTime.nowUnsafe());
  const open = openInvoice(overview, now);

  return (
    <CardSection
      description={
        plan.kind === "trial"
          ? t("billing-trial-description", {
              date: formatBillingDate(plan.endsAt, locale),
            })
          : t("billing-paid-description", {
              date: formatBillingDate(
                (plan.kind === "contract" ? plan.validTo : plan.period.end) - 1,
                locale
              ),
            })
      }
      title={t(`billing-plan-${plan.kind}`)}
    >
      <CardContent>
        <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-3 text-sm">
          <dt className="text-muted-foreground">{t("billing-credits")}</dt>
          <dd>
            {plan.kind === "trial"
              ? t("billing-credits-trial", {
                  total: formatCount(schoolTiers.free.credits, locale),
                })
              : t("billing-credits-used", {
                  total: formatCount(plan.credits.capacity, locale),
                  used: formatCount(plan.credits.used, locale),
                })}
          </dd>
          <dt className="text-muted-foreground">{t("billing-drive")}</dt>
          <dd>{formatDrive(overview.driveBytes, locale)}</dd>
        </dl>
      </CardContent>
      <CardSectionFooter
        hint={Option.match(open, {
          onNone: () =>
            t(
              plan.kind === "trial"
                ? "billing-trial-footer"
                : "billing-renew-footer"
            ),
          onSome: (invoice) =>
            t("billing-open-footer", {
              date: formatBillingDate(invoice.dueAt, locale),
            }),
        })}
      >
        <CardSectionActions>
          {Option.match(open, {
            onNone: () => (
              <Button
                onClick={() => setIsOrdering(true)}
                type="button"
                variant={plan.kind === "trial" ? "default" : "outline"}
              >
                <HugeIcons icon={Diamond02Icon} />
                {t(plan.kind === "trial" ? "billing-choose" : "billing-renew")}
              </Button>
            ),
            onSome: (invoice) => (
              <SchoolPayButton
                link={invoice.paymentLink}
                number={invoice.number}
              />
            ),
          })}
        </CardSectionActions>
      </CardSectionFooter>
      <SchoolOrderDialog
        billing={overview}
        kind="plan"
        open={isOrdering}
        setOpen={setIsOrdering}
      />
    </CardSection>
  );
}

/** Pays the open invoice: on its hosted page while it holds one, or by a bank transfer that quotes its number. */
function SchoolPayButton({
  link,
  number,
}: {
  link: SchoolBilling["invoices"][number]["paymentLink"];
  number: SchoolBilling["invoices"][number]["number"];
}) {
  const t = useTranslations("SchoolSettings");

  return link === null ? (
    <Button
      disabled={number === ""}
      render={<a href={transferMailto(number)} title={t("invoice-transfer")} />}
    >
      <HugeIcons icon={Mail01Icon} />
      {t("invoice-transfer")}
    </Button>
  ) : (
    <Button
      render={
        <a
          href={link}
          rel="noopener"
          target="_blank"
          title={t("invoice-pay")}
        />
      }
    >
      <HugeIcons icon={CreditCardIcon} />
      {t("invoice-pay")}
    </Button>
  );
}

/**
 * The accounts of the school, every role counted once per person, against the accounts its
 * plan pays for. Its one action adds accounts to the plan that runs, for the days left in
 * its period; the trial has no plan to add them to, so it orders one.
 */
function SchoolAccountsCard({ billing: overview }: { billing: SchoolBilling }) {
  const t = useTranslations("SchoolSettings");
  const locale = useLocale();
  const [isAdding, setIsAdding] = useState(false);
  const { limit, used } = overview.accounts;
  const running = paidPlan(overview);
  const kind = Option.isSome(running) ? "accounts" : "plan";

  return (
    <CardSection
      description={t("billing-accounts-description")}
      title={t("billing-accounts")}
    >
      <CardContent className="grid gap-2">
        <p className="text-sm tabular-nums">
          {t("billing-accounts-used", {
            total: formatCount(limit, locale),
            used: formatCount(used, locale),
          })}
        </p>
        <Meter
          label={t("billing-accounts")}
          percent={Math.min(Math.round((used / Math.max(limit, 1)) * 100), 100)}
        />
      </CardContent>
      <CardSectionFooter
        hint={
          Option.isSome(running)
            ? t("billing-accounts-footer")
            : t("billing-accounts-trial", {
                limit: formatCount(schoolTiers.free.accounts, locale),
              })
        }
      >
        <CardSectionActions>
          <Button
            onClick={() => setIsAdding(true)}
            type="button"
            variant={Option.isSome(running) ? "default" : "outline"}
          >
            <HugeIcons icon={UserAdd01Icon} />
            {t("billing-add-accounts")}
          </Button>
        </CardSectionActions>
      </CardSectionFooter>
      <SchoolOrderDialog
        billing={overview}
        kind={kind}
        open={isAdding}
        setOpen={setIsAdding}
      />
    </CardSection>
  );
}
