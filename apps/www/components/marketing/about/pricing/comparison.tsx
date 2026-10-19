import { Nina } from "@repo/design-system/components/ui/nina";
import { Thing } from "@repo/design-system/components/ui/thing";
import { Array as Arr } from "effect";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import {
  currencySymbol,
  drinkKey,
  type ProMonthlyPricing,
  proMonthlyPricings,
} from "@/components/marketing/about/pricing/display";
import { pricingSums } from "@/components/marketing/about/pricing/sums";

/** One comparison: its picture, its sum, and the sentence that says what it means, centred in its column. */
function Comparison({
  note,
  picture,
  title,
}: {
  note: string;
  picture: ReactNode;
  title: string;
}) {
  return (
    <div className="grid content-start justify-items-center gap-2 text-center">
      <span className="flex h-12 items-center justify-center">{picture}</span>
      <p className="mt-2 text-balance font-medium text-xl tabular-nums tracking-tight">
        {title}
      </p>
      <p className="max-w-72 text-pretty text-base text-muted-foreground">
        {note}
      </p>
    </div>
  );
}

/** One name for each cup the comparison draws, in order: its place in the row. */
function cupsOf(count: number) {
  return Arr.makeBy(count, (place) => `cup-${place + 1}`);
}

/** The coin of a price: its currency symbol in a round yellow badge as tall as the other pictures. */
function PriceCoin({ symbol }: { symbol: string }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-11 items-center justify-center rounded-full bg-pop-yellow font-bold text-base text-nina-ink"
    >
      {symbol}
    </span>
  );
}

/**
 * The comparisons under one currency's price. Each sum comes from that price and
 * from the credits of the plans, and each sentence has an estimating word of its own.
 */
function CurrencyComparison({ pricing }: { pricing: ProMonthlyPricing }) {
  const t = useTranslations("PricingPage");
  const { formatter, price } = pricing;
  const sums = pricingSums(price);
  const perDayNote =
    price.currency === "IDR" ? t("per-day-note-idr") : t("per-day-note-other");

  return (
    <div className="grid gap-12" data-price-currency={price.currency}>
      <h2 className="text-balance text-center text-3xl tracking-tight sm:text-4xl">
        {t("comparison-title", { price: formatter.format(price.amount) })}
      </h2>
      <div className="mx-auto grid w-full max-w-5xl gap-10 md:grid-cols-3">
        <Comparison
          note={t("drink-note")}
          picture={
            <span className="flex gap-1">
              {Arr.map(cupsOf(sums.drinks), (cup) => (
                <Thing key={cup} name="coffee" size={40} />
              ))}
            </span>
          }
          title={t("drink-title", {
            count: sums.drinks,
            item: t(drinkKey(price.currency), { count: sums.drinks }),
          })}
        />
        <Comparison
          note={perDayNote}
          picture={<PriceCoin symbol={currencySymbol(formatter)} />}
          title={t("per-day-title", {
            price: formatter.format(sums.pricePerDay),
          })}
        />
        <Comparison
          note={t("answers-note", { perDay: sums.answersPerDay })}
          picture={
            <Nina label="" lean="right" mood="aha" size={44} tile="cream" />
          }
          title={t("answers-title", { answers: sums.answersPerMonth })}
        />
      </div>
    </div>
  );
}

/**
 * The comparison section of the pricing page. Its sums depend on the visitor's
 * currency, so every currency's comparison is in the HTML, and the page shows
 * the visitor's one from the first paint.
 */
export function PricingComparison() {
  return (
    <section
      className="scroll-mt-28 px-6 py-20 lg:px-10 lg:py-32"
      id="comparison"
    >
      <div className="mx-auto grid w-full max-w-7xl gap-12">
        {Arr.map(proMonthlyPricings, (pricing) => (
          <CurrencyComparison key={pricing.price.currency} pricing={pricing} />
        ))}
      </div>
    </section>
  );
}
