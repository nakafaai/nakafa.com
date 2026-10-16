import { Nina } from "@repo/design-system/components/ui/nina";
import { Thing } from "@repo/design-system/components/ui/thing";
import { Array as Arr, Option } from "effect";
import { headers } from "next/headers";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Suspense, use } from "react";
import {
  getProMonthlyPricing,
  pricingCountryHeaderName,
} from "@/components/marketing/about/pricing/display";
import { pricingSums } from "@/components/marketing/about/pricing/sums";

/** One comparison: its picture, its sum in bold, and the sentence that says what it means. */
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
    <div className="grid justify-items-center gap-2 text-center">
      <span className="flex h-6 items-center justify-center">{picture}</span>
      <p className="mt-2 font-medium text-xl tabular-nums tracking-tight">
        {title}
      </p>
      <p className="max-w-60 text-pretty text-base text-muted-foreground">
        {note}
      </p>
    </div>
  );
}

/** The coin of a price: its currency symbol in a round yellow badge the size of an icon. */
function PriceCoin({ symbol }: { symbol: string }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-6 items-center justify-center rounded-full bg-pop-yellow font-bold text-[10px] text-nina-ink"
    >
      {symbol}
    </span>
  );
}

/** The key of the drink that a monthly price buys in its own currency. */
function drinkKey(currency: string): "drink-eur" | "drink-idr" | "drink-usd" {
  if (currency === "IDR") {
    return "drink-idr";
  }
  if (currency === "EUR") {
    return "drink-eur";
  }
  return "drink-usd";
}

/** The currency symbol of a price, as the price's own locale writes it. */
function currencySymbol(formatter: Intl.NumberFormat, currency: string) {
  return Option.match(
    Arr.findFirst(
      formatter.formatToParts(0),
      (part) => part.type === "currency"
    ),
    {
      onNone: () => currency,
      onSome: (part) => part.value,
    }
  );
}

/**
 * The comparisons under the price of the visitor's region. Each sum comes from
 * that price and from the credits of the plans, and each sentence has an
 * estimating word of its own.
 */
function ResolvedComparison() {
  const t = useTranslations("PricingPage");
  const requestHeaders = use(headers());
  const { formatter, price } = getProMonthlyPricing(
    requestHeaders.get(pricingCountryHeaderName)
  );
  const sums = pricingSums(price);
  const perDayNote =
    price.currency === "IDR" ? t("per-day-note-idr") : t("per-day-note-other");

  return (
    <>
      <h2
        className="text-balance text-3xl tracking-tight sm:text-4xl"
        id="comparison-heading"
      >
        {t("comparison-title", { price: formatter.format(price.amount) })}
      </h2>
      <div className="grid gap-10 md:grid-cols-3">
        <Comparison
          note={t("drink-note")}
          picture={<Thing name="coffee" size={24} />}
          title={t("drink-title", {
            count: sums.drinks,
            item: t(drinkKey(price.currency)),
          })}
        />
        <Comparison
          note={perDayNote}
          picture={
            <PriceCoin symbol={currencySymbol(formatter, price.currency)} />
          }
          title={t("per-day-title", {
            price: formatter.format(sums.pricePerDay),
          })}
        />
        <Comparison
          note={t("answers-note", { perDay: sums.answersPerDay })}
          picture={
            <Nina label="" lean="right" mood="aha" size={24} tile="cream" />
          }
          title={t("answers-title", { answers: sums.answersPerMonth })}
        />
      </div>
    </>
  );
}

/**
 * The comparison section of the pricing page. Its sums depend on the visitor's
 * region, so it streams in, and nothing is shown until its price is known.
 */
export function PricingComparison() {
  return (
    <section
      className="scroll-mt-28 px-6 py-20 lg:px-10 lg:py-32"
      id="comparison"
    >
      <div className="mx-auto grid w-full max-w-7xl gap-12">
        <Suspense fallback={null}>
          <ResolvedComparison />
        </Suspense>
      </div>
    </section>
  );
}
