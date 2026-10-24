import { describe, expect, it } from "@effect/vitest";
import { readCookie } from "@repo/internationalization/src/cookie";
import { Option } from "effect";

/** The request headers that carry one `Cookie` header, or none. */
const withCookie = (cookie: string | undefined) => {
  const headers = new Headers();
  if (cookie !== undefined) {
    headers.set("cookie", cookie);
  }
  return headers;
};

describe("cookie reading", () => {
  it("reads the value of a named cookie among others", () => {
    expect(
      readCookie(withCookie("a=1; NAKAFA_LOCALE=de; b=2"), "NAKAFA_LOCALE")
    ).toStrictEqual(Option.some("de"));
  });

  it("keeps the equal signs of a value", () => {
    expect(readCookie(withCookie("token=a=b=c"), "token")).toStrictEqual(
      Option.some("a=b=c")
    );
  });

  it("reads the first cookie with the name", () => {
    expect(readCookie(withCookie("x=1; x=2"), "x")).toStrictEqual(
      Option.some("1")
    );
  });

  it.each(["XNAKAFA_LOCALE=de", "NAKAFA_LOCALE_OLD=de", "other=NAKAFA_LOCALE"])(
    "does not match %s",
    (cookie) => {
      expect(readCookie(withCookie(cookie), "NAKAFA_LOCALE")).toStrictEqual(
        Option.none()
      );
    }
  );

  it("has no cookie without a Cookie header", () => {
    expect(readCookie(withCookie(undefined), "NAKAFA_LOCALE")).toStrictEqual(
      Option.none()
    );
  });
});
