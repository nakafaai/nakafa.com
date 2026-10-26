import { Wallet01Icon } from "@hugeicons/core-free-icons";
import { billingOffer } from "@repo/backend/confect/billing/catalog";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Radio,
  RadioGroup,
} from "@repo/design-system/components/ui/radio-group";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Array as Arr, Option } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import type { ProOffer } from "@/lib/billing/checkout";
import { formatMinorAmount } from "@/lib/billing/plan";

/**
 * The payment method dialog: the Pro offers the learner's currency sells, the
 * monthly plan that renews by itself and the passes paid once, each with how it
 * is paid and its price. Continue starts the chosen offer's checkout. The first
 * offer is chosen until the learner picks another.
 */
export function ProOfferDialog({
  choose,
  dismiss,
  isPending,
  offers,
}: {
  choose: (offer: ProOffer["offer"]) => void;
  dismiss: () => void;
  isPending: boolean;
  offers: readonly ProOffer[] | null;
}) {
  const t = useTranslations("Pricing");
  const common = useTranslations("Common");
  const [picked, setPicked] = useState<ProOffer["offer"] | null>(null);
  const chosen = Option.getOrNull(
    Option.orElse(
      Arr.findFirst(offers ?? [], ({ offer }) => offer === picked),
      () => Arr.head(offers ?? [])
    )
  );

  return (
    <ResponsiveDialog
      description={t("offer-description")}
      footer={
        <>
          <Button onClick={dismiss} type="button" variant="outline">
            {common("cancel")}
          </Button>
          <Button
            disabled={chosen === null || isPending}
            onClick={() => {
              if (chosen !== null) {
                choose(chosen.offer);
              }
            }}
            type="button"
          >
            <HugeIcons icon={Wallet01Icon} />
            {t("offer-continue")}
          </Button>
        </>
      }
      open={offers !== null}
      setOpen={(open) => {
        if (!open) {
          dismiss();
        }
      }}
      title={t("offer-title")}
    >
      <RadioGroup
        aria-label={t("offer-title")}
        onValueChange={(value) => {
          const offer = Arr.findFirst(
            offers ?? [],
            (candidate) => candidate.offer === value
          );
          setPicked(Option.getOrNull(Option.map(offer, ({ offer }) => offer)));
        }}
        value={chosen?.offer ?? ""}
      >
        {Arr.map(offers ?? [], (offer) => (
          <ProOfferOption key={offer.offer} offer={offer} />
        ))}
      </RadioGroup>
    </ResponsiveDialog>
  );
}

/** One offer: its name, how it is paid, and its price. */
function ProOfferOption({ offer }: { offer: ProOffer }) {
  const t = useTranslations("Pricing");
  const isPass = billingOffer(offer.offer).interval === "pass";

  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 has-data-checked:border-primary">
      <Radio className="mt-0.5" value={offer.offer} />
      <span className="grid flex-1 gap-1">
        <span className="font-medium text-sm">
          {isPass
            ? t("offer-pass", { months: offer.months })
            : t("offer-monthly")}
        </span>
        <span className="text-muted-foreground text-sm">
          {t(isPass ? "offer-pass-method" : "offer-monthly-method")}
        </span>
      </span>
      <span className="font-medium text-sm tabular-nums">
        {formatMinorAmount(offer.amount, offer.currency)}
      </span>
    </label>
  );
}
