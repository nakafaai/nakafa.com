// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import {
  currencyForCountry,
  currencyForTimeZone,
  PRICING_CURRENCY_ATTRIBUTE,
  pricingCurrencyCookieFor,
  pricingCurrencyScript,
  readCurrencyCookie,
  readShownCurrency,
} from "@/lib/pricing/currency";

/** The headers of one request that carries a `Cookie` header. */
const withCookie = (cookie: string) => new Headers({ cookie });

/**
 * Runs the inline script in a stub browser. The stub holds the cookie, the time
 * zone reader, and the root element, and the script's attribute is returned.
 */
function runPricingScript(input: {
  readonly cookie: string;
  readonly intl: unknown;
}) {
  const attributes: Record<string, string> = {};
  const documentStub = {
    cookie: input.cookie,
    documentElement: {
      setAttribute: (name: string, value: string) => {
        attributes[name] = value;
      },
    },
  };
  // The script is the browser's own code, and the test runs it as the page does.
  new Function("document", "Intl", pricingCurrencyScript())(
    documentStub,
    input.intl
  );
  return attributes[PRICING_CURRENCY_ATTRIBUTE];
}

/** A stub `Intl` whose formatter reports one time zone. */
const timeZoneIntl = (timeZone: string | undefined) => ({
  DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone }) }),
});

describe("currency of a country", () => {
  it.each([
    ["ID", "IDR"],
    ["de", "EUR"],
    ["FR", "EUR"],
    ["US", "USD"],
    ["GB", "USD"],
    [null, "USD"],
  ] as const)("prices country %s in %s", (country, currency) => {
    expect(currencyForCountry(country)).toBe(currency);
  });
});

describe("currency of a time zone", () => {
  it.each([
    ["Asia/Jakarta", "IDR"],
    ["Asia/Makassar", "IDR"],
    ["Asia/Jayapura", "IDR"],
    ["Europe/Berlin", "EUR"],
    ["Asia/Nicosia", "EUR"],
    ["Europe/London", "USD"],
    ["America/New_York", "USD"],
    ["", "USD"],
  ])("prices time zone %s in %s", (zone, currency) => {
    expect(currencyForTimeZone(zone)).toBe(currency);
  });
});

describe("currency cookie", () => {
  it("reads the price currency that the cookie names", () => {
    expect(
      readCurrencyCookie(withCookie("a=1; pricing_currency=EUR"))
    ).toStrictEqual(Option.some("EUR"));
  });

  it.each(["pricing_currency=GBP", "pricing_currency=", "other=IDR"])(
    "ignores the cookie %s",
    (cookie) => {
      expect(readCurrencyCookie(withCookie(cookie))).toStrictEqual(
        Option.none()
      );
    }
  );

  it("reads the first cookie of the name when a request repeats it", () => {
    expect(
      readCurrencyCookie(
        withCookie("pricing_currency=IDR; pricing_currency=EUR")
      )
    ).toStrictEqual(Option.some("IDR"));
  });

  it("has no currency without a Cookie header", () => {
    expect(readCurrencyCookie(new Headers())).toStrictEqual(Option.none());
  });
});

describe("shown currency", () => {
  it("reads the currency the inline script set, and the dollar price when it set none or an unknown one", () => {
    const rootWith = (value: string | null) => ({
      getAttribute: (name: string) =>
        name === PRICING_CURRENCY_ATTRIBUTE ? value : null,
    });
    expect(readShownCurrency(rootWith("IDR"))).toBe("IDR");
    expect(readShownCurrency(rootWith("EUR"))).toBe("EUR");
    expect(readShownCurrency(rootWith(null))).toBe("USD");
    expect(readShownCurrency(rootWith("GBP"))).toBe("USD");
  });
});

describe("pricing currency script", () => {
  it("keeps the cookie's supported currency over the time zone", () => {
    expect(
      runPricingScript({
        cookie: "pricing_currency=IDR",
        intl: timeZoneIntl("Europe/Berlin"),
      })
    ).toBe("IDR");
  });

  it("reads the time zone when the cookie names no supported currency", () => {
    expect(
      runPricingScript({
        cookie: "pricing_currency=GBP",
        intl: timeZoneIntl("Europe/Berlin"),
      })
    ).toBe("EUR");
  });

  it("keeps the first currency cookie that the browser sends", () => {
    expect(
      runPricingScript({
        cookie: "pricing_currency=IDR; pricing_currency=EUR",
        intl: timeZoneIntl("America/New_York"),
      })
    ).toBe("IDR");
  });

  it("shows the dollar price for a time zone that is not mapped", () => {
    expect(
      runPricingScript({
        cookie: "",
        intl: timeZoneIntl("America/New_York"),
      })
    ).toBe("USD");
  });

  it("shows the dollar price when the browser names no time zone", () => {
    expect(
      runPricingScript({ cookie: "", intl: timeZoneIntl(undefined) })
    ).toBe("USD");
  });

  it("shows the dollar price when the time zone cannot be read", () => {
    expect(
      runPricingScript({
        cookie: "",
        intl: {
          DateTimeFormat: () => {
            throw new Error("Intl is unavailable.");
          },
        },
      })
    ).toBe("USD");
  });

  it("writes the mapping into the script without a closing script tag", () => {
    const script = pricingCurrencyScript();
    expect(script).toContain('"Asia/Jakarta":"IDR"');
    expect(script).not.toContain("</script");
  });
});

describe("pricing currency cookie", () => {
  it("sets the currency of the request country when no cookie is set yet", () => {
    const cookie = pricingCurrencyCookieFor(
      new Headers({ "CF-IPCountry": "ID" })
    );
    expect(Option.getOrUndefined(cookie)).toBe(
      "pricing_currency=IDR; Path=/; SameSite=Lax; Max-Age=86400"
    );
  });

  it("keeps a currency cookie that already matches the request country", () => {
    const cookie = pricingCurrencyCookieFor(
      new Headers({
        cookie: "pricing_currency=IDR",
        "CF-IPCountry": "ID",
      })
    );
    expect(Option.isNone(cookie)).toBe(true);
  });

  it("replaces a currency cookie that differs from the request country", () => {
    const cookie = pricingCurrencyCookieFor(
      new Headers({
        cookie: "pricing_currency=EUR",
        "CF-IPCountry": "ID",
      })
    );
    expect(Option.getOrUndefined(cookie)).toBe(
      "pricing_currency=IDR; Path=/; SameSite=Lax; Max-Age=86400"
    );
  });

  it("replaces a cookie that holds no known currency", () => {
    const cookie = pricingCurrencyCookieFor(
      new Headers({
        cookie: "pricing_currency=XYZ",
        "CF-IPCountry": "DE",
      })
    );
    expect(Option.getOrUndefined(cookie)).toContain(
      "pricing_currency=EUR; Path=/"
    );
  });

  it("sets nothing for a request that names no country", () => {
    expect(Option.isNone(pricingCurrencyCookieFor(new Headers()))).toBe(true);
  });
});
