import {
  Array as Arr,
  MutableHashMap,
  Option,
  Result,
  Schema,
  String as Str,
} from "effect";

/** A symbol in letters that opens a price, and any space after it. */
const LETTER_SYMBOL = /^(?<symbol>\p{L}+)\s*/u;

/** One currency as an amount is written in it: its code, its digits and the locale that writes it. */
const Money = Schema.Struct({
  currency: Schema.String,
  digits: Schema.Int,
  locale: Schema.String,
});

/** The platform formatter of every money format a page wrote, by its locale, currency and digits. */
const MONEY_FORMATS = MutableHashMap.empty<string, Intl.NumberFormat>();

/** The platform formatter of one money format, built at its first use. */
function moneyFormat(money: typeof Money.Type) {
  const key = `${money.locale} ${money.currency} ${money.digits}`;
  return Option.getOrElse(MutableHashMap.get(MONEY_FORMATS, key), () => {
    const format = new Intl.NumberFormat(money.locale, {
      currency: money.currency,
      maximumFractionDigits: money.digits,
      minimumFractionDigits: money.digits,
      style: "currency",
    });
    MutableHashMap.set(MONEY_FORMATS, key, format);
    return format;
  });
}

/**
 * An amount in major units of one currency, as its locale writes it: Rp 79.000,
 * $10.00, 10,00 €. Each engine spaces a symbol in letters its own way, Chrome
 * with a no-break space and Safari with none, so a page prerendered by one and
 * hydrated by the other would differ; a symbol in letters always takes the
 * no-break space here.
 */
export function formatCurrency(amount: number, money: typeof Money.Type) {
  return Str.replace(
    LETTER_SYMBOL,
    "$<symbol>\u00a0"
  )(moneyFormat(money).format(amount));
}

/** The symbol a currency writes in one locale, such as Rp for the rupiah or € for the euro. */
export function currencySymbol(currency: string, locale: string) {
  return Arr.join(
    Arr.filterMap(
      new Intl.NumberFormat(locale, {
        currency,
        currencyDisplay: "narrowSymbol",
        style: "currency",
      }).formatToParts(0),
      (part) =>
        part.type === "currency" ? Result.succeed(part.value) : Result.failVoid
    ),
    ""
  );
}
