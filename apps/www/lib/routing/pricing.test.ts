import { describe, expect, it } from "@effect/vitest";
import { NextRequest, NextResponse } from "next/server";
import { writePricingCurrencyCookie } from "@/lib/routing/pricing";

const PATH = "http://localhost:3000/id/pricing";

/** Runs the cookie writer for a visit from one country, with an optional cookie. */
function writeFor({ country, cookie }: { country?: string; cookie?: string }) {
  const request = new NextRequest(PATH, {
    headers: {
      ...(country ? { "x-vercel-ip-country": country } : {}),
      ...(cookie ? { cookie } : {}),
    },
  });
  const response = NextResponse.next();
  writePricingCurrencyCookie(request, response);
  return response;
}

describe("routing/pricing-currency", () => {
  it("sets the currency of the visitor's country as a readable first-party cookie", () => {
    const cookie = writeFor({ country: "ID" }).cookies.get("pricing_currency");

    expect(cookie).toMatchObject({
      name: "pricing_currency",
      path: "/",
      sameSite: "lax",
      value: "IDR",
    });
    expect(cookie?.httpOnly).toBeFalsy();
    expect(cookie?.maxAge).toBe(60 * 60 * 24);
  });

  it("sets the euro currency for a Polar euro country and the dollar currency without a country", () => {
    expect(
      writeFor({ country: "DE" }).cookies.get("pricing_currency")?.value
    ).toBe("EUR");
    expect(writeFor({}).cookies.get("pricing_currency")?.value).toBe("USD");
  });

  it("sets nothing when the cookie already holds the visitor's currency", () => {
    const response = writeFor({
      country: "ID",
      cookie: "pricing_currency=IDR",
    });

    expect(response.cookies.get("pricing_currency")).toBeUndefined();
  });

  it("replaces a cookie that holds another currency", () => {
    const response = writeFor({
      country: "ID",
      cookie: "pricing_currency=USD",
    });

    expect(response.cookies.get("pricing_currency")?.value).toBe("IDR");
  });
});
