import { useAction } from "@confect/react";
import { Wallet01Icon } from "@hugeicons/core-free-icons";
import billing from "@repo/backend/confect/_generated/refs/billing";
import { billingOfferPrice } from "@repo/backend/confect/billing/catalog";
import { unpaidAccounts } from "@repo/backend/confect/billing/quote";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Radio,
  RadioGroup,
} from "@repo/design-system/components/ui/radio-group";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Array as Arr, Option, Schema } from "effect";
import { useState, useTransition } from "react";
import { useFormatter, useLocale, useTranslations } from "use-intl";
import { useTenant } from "@/components/tenant/context";
import { runSchoolWrite, schoolCall } from "@/components/tenant/write";
import { formatMinorAmount } from "@/lib/billing/plan";
import type { SchoolBilling } from "@/lib/billing/school";
import { isActiveLocale } from "@/lib/i18n/active";

/** The Polar seat offers a school outside Indonesia buys: monthly or yearly seats that renew until it cancels them. */
const PolarSeatOffer = Schema.Literals([
  "school.seat.month",
  "school.seat.year",
]);
type PolarSeatOffer = typeof PolarSeatOffer.Type;

/**
 * Buys Polar seats for a school outside Indonesia: one seat for each account no grant
 * pays for yet, monthly or yearly, on Polar's own checkout page, which the school
 * leaves back to its billing.
 */
export function SchoolSeatsDialog({
  billing: overview,
  open,
  setOpen,
}: {
  billing: SchoolBilling;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const t = useTranslations("SchoolSettings");
  const locale = useLocale();
  const format = useFormatter();
  const { slug } = useTenant();
  const [offer, setOffer] = useState<PolarSeatOffer>("school.seat.month");
  const [isPending, startPaying] = useTransition();
  const checkout = useAction(billing.polar.school.checkout);
  const seats = unpaidAccounts(overview);

  const submit = () => {
    if (!isActiveLocale(locale)) {
      return;
    }
    setOpen(false);
    startPaying(() =>
      runSchoolWrite(
        schoolCall(() => checkout({ locale, offer, slug })),
        {
          onSaved: ({ url }) => {
            window.location.href = url;
          },
        }
      )
    );
  };

  return (
    <ResponsiveDialog
      action={
        <Button
          disabled={seats < 1 || isPending}
          inert={isPending}
          onClick={submit}
          type="button"
        >
          <HugeIcons icon={Wallet01Icon} />
          {t("billing-checkout")}
        </Button>
      }
      description={t("billing-seats-description", {
        seats: format.number(seats),
      })}
      open={open}
      setOpen={setOpen}
      title={t("billing-seats-title")}
    >
      <RadioGroup
        aria-label={t("billing-seats-title")}
        onValueChange={(value) => {
          if (Schema.is(PolarSeatOffer)(value)) {
            setOffer(value);
          }
        }}
        value={offer}
      >
        {Arr.map(PolarSeatOffer.literals, (each) => (
          <SchoolSeatOption
            currency={overview.currency}
            key={each}
            offer={each}
            seats={seats}
          />
        ))}
      </RadioGroup>
    </ResponsiveDialog>
  );
}

/** One seat offer: how often it renews and its total, then the price of each seat. */
function SchoolSeatOption({
  currency,
  offer,
  seats,
}: {
  currency: SchoolBilling["currency"];
  offer: PolarSeatOffer;
  seats: number;
}) {
  const t = useTranslations("SchoolSettings");
  const price = Option.getOrElse(
    Option.fromNullishOr(billingOfferPrice(offer, currency)),
    () => 0
  );

  return (
    <label className="has-data-checked:border-primary flex cursor-pointer items-start gap-3 rounded-lg border p-4">
      <Radio className="mt-0.5" value={offer} />
      <span className="grid flex-1 gap-1">
        <span className="flex items-baseline justify-between gap-3 text-sm font-medium">
          <span>
            {t(
              offer === "school.seat.month"
                ? "billing-seats-month"
                : "billing-seats-year"
            )}
          </span>
          <span className="whitespace-nowrap tabular-nums">
            {formatMinorAmount(price * seats, currency)}
          </span>
        </span>
        <span className="text-muted-foreground text-sm">
          {t("billing-seats-each", {
            price: formatMinorAmount(price, currency),
          })}
        </span>
      </span>
    </label>
  );
}
