import { describe, expect, it } from "@effect/vitest";
import { decideRedirect } from "@repo/internationalization/src/redirect";
import { Option } from "effect";

/** The redirect decided for one address and its request headers. */
const decide = (
  address: string,
  acceptLanguage?: string,
  isSchoolHost = false
) => {
  const headers = new Headers();
  if (acceptLanguage !== undefined) {
    headers.set("accept-language", acceptLanguage);
  }
  return decideRedirect({ headers, isSchoolHost, url: new URL(address) });
};

/** The location of a redirect that the request answers, or none. */
const locationOf = (
  address: string,
  acceptLanguage?: string,
  isSchoolHost = false
) =>
  decide(address, acceptLanguage, isSchoolHost).pipe(
    Option.map((d) => d.location)
  );

describe("root redirect", () => {
  it("answers the root with the default locale and a 307 that varies", () => {
    expect(decide("https://nakafa.com/")).toStrictEqual(
      Option.some({
        location: "/en",
        status: 307,
        vary: "Accept-Language, Cookie",
      })
    );
  });

  it.each([
    ["id-ID,id;q=0.9", "/id"],
    ["de-DE,de;q=0.9", "/de"],
  ])("answers the root for Accept-Language %s with %s", (header, location) => {
    expect(decide("https://nakafa.com/", header)).toStrictEqual(
      Option.some({
        location,
        status: 307,
        vary: "Accept-Language, Cookie",
      })
    );
  });

  it("keeps the query on the root answer", () => {
    expect(locationOf("https://nakafa.com/?utm=x")).toStrictEqual(
      Option.some("/en?utm=x")
    );
  });

  it("answers a path of slashes as the root", () => {
    expect(locationOf("https://nakafa.com//")).toStrictEqual(
      Option.some("/en")
    );
  });

  it("uses the locale cookie before Accept-Language", () => {
    const headers = new Headers({
      "accept-language": "id-ID",
      cookie: "NAKAFA_LOCALE=de",
    });
    const decision = decideRedirect({
      headers,
      isSchoolHost: false,
      url: new URL("https://nakafa.com/"),
    });
    expect(decision.pipe(Option.map((d) => d.location))).toStrictEqual(
      Option.some("/de")
    );
  });
});

describe("permanent redirects", () => {
  it.each([
    ["https://nakafa.com/en/curriculum/", "/en/curriculum"],
    ["https://nakafa.com/en/curricula", "/en/curriculum"],
    ["https://nakafa.com/en/materials/x/?tab=1", "/en/subjects/x?tab=1"],
    ["https://nakafa.com/de/curricula/merdeka/", "/de/lehrplaene/merdeka"],
    ["https://nakafa.com/id/materials/matematika", "/id/materi/matematika"],
  ])("moves %s to %s with a 308", (address, location) => {
    expect(decide(address)).toStrictEqual(
      Option.some({ location, status: 308 })
    );
  });

  it.each([
    "https://nakafa.com/en/curriculum",
    "https://nakafa.com/id/materi/matematika",
    "https://nakafa.com/fr/curriculum",
    "https://nakafa.com/id/subjects/matematika",
    "https://nakafa.com/api/ping/",
    "https://nakafa.com/robots.txt",
    "https://nakafa.com/_serverFn/abc/",
  ])("leaves %s to the router", (address) => {
    expect(Option.isNone(decide(address))).toBe(true);
  });
});

describe("school hosts", () => {
  it("keeps the school home without a locale redirect", () => {
    expect(
      Option.isNone(decide("https://harapan.nakafa.com/", undefined, true))
    ).toBe(true);
  });

  it("removes a trailing slash with a 308 and keeps the host", () => {
    expect(
      decide("https://harapan.nakafa.com/exams/?x=1", undefined, true)
    ).toStrictEqual(Option.some({ location: "/exams?x=1", status: 308 }));
  });

  it("leaves a shared root file on a school host to the router", () => {
    expect(
      Option.isNone(
        decide(
          "https://harapan.nakafa.com/e22d548f7fd2482a9022e3b84e944901.txt",
          undefined,
          true
        )
      )
    ).toBe(true);
  });

  it("leaves a school path without a trailing slash", () => {
    expect(
      Option.isNone(decide("https://harapan.nakafa.com/exams", undefined, true))
    ).toBe(true);
  });
});

describe("slashes in a path", () => {
  it.each([
    ["https://nakafa.com//evil.com/", "/evil.com"],
    ["https://nakafa.com/en//curriculum", "/en/curriculum"],
    ["https://nakafa.com/en/curriculum//", "/en/curriculum"],
  ])("moves %s to the single-slash path %s", (address, location) => {
    expect(locationOf(address)).toStrictEqual(Option.some(location));
  });

  it.each([
    "https://harapan.nakafa.com//evil.com/",
    "https://harapan.nakafa.com///evil.com",
  ])("never answers %s with a protocol-relative location", (address) => {
    expect(locationOf(address, undefined, true)).toStrictEqual(
      Option.some("/evil.com")
    );
  });

  it("answers a path of slashes on the root with the root redirect", () => {
    expect(decide("https://nakafa.com///", "de-DE")).toStrictEqual(
      Option.some({
        location: "/de",
        status: 307,
        vary: "Accept-Language, Cookie",
      })
    );
  });
});
