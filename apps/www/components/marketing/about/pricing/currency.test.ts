// @vitest-environment node

import { runInNewContext } from "node:vm";
import { describe, expect, it } from "@effect/vitest";
import {
  PRICING_CURRENCY_ROOT_ATTRIBUTE,
  PRICING_CURRENCY_SCRIPT,
} from "@/components/marketing/about/pricing/currency";

/** Runs the root layout's script against a document that holds this cookie header. */
function runScript(cookie: string) {
  let mark: [string, string] | undefined;
  runInNewContext(PRICING_CURRENCY_SCRIPT, {
    document: {
      cookie,
      documentElement: {
        setAttribute: (name: string, value: string) => {
          mark = [name, value];
        },
      },
    },
  });
  return mark;
}

describe("marketing/about/pricing-currency", () => {
  it.each(["IDR", "EUR", "USD"])(
    "marks the root with the visitor's %s currency from its cookie",
    (currency) => {
      expect(runScript(`theme=dark; pricing_currency=${currency}`)).toEqual([
        PRICING_CURRENCY_ROOT_ATTRIBUTE,
        currency,
      ]);
    }
  );

  it("leaves the root unmarked, so USD shows, without the cookie", () => {
    expect(runScript("theme=dark")).toBeUndefined();
    expect(runScript("")).toBeUndefined();
  });

  it("leaves the root unmarked for a value that names no known currency", () => {
    expect(runScript("pricing_currency=JPY")).toBeUndefined();
    expect(runScript("pricing_currency=")).toBeUndefined();
  });

  it("does not read a cookie whose name only starts with the cookie name", () => {
    expect(runScript("pricing_currency_old=EUR")).toBeUndefined();
  });

  it("keeps the USD default when the cookie cannot be read", () => {
    let mark: [string, string] | undefined;

    expect(() =>
      runInNewContext(PRICING_CURRENCY_SCRIPT, {
        document: {
          get cookie(): string {
            throw new Error("Cookies are blocked.");
          },
          documentElement: {
            setAttribute: (name: string, value: string) => {
              mark = [name, value];
            },
          },
        },
      })
    ).not.toThrow();
    expect(mark).toBeUndefined();
  });
});
