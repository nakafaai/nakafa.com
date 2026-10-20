import { describe, expect, it } from "@effect/vitest";
import {
  decideRootRedirect,
  decideSlashRedirect,
  decideSpellingRedirect,
} from "@repo/internationalization/src/redirect";
import { Option } from "effect";

/** The root redirect decided for one address and its request headers. */
const decideRoot = (
  address: string,
  acceptLanguage?: string,
  isSchoolHost = false
) => {
  const headers = new Headers();
  if (acceptLanguage !== undefined) {
    headers.set("accept-language", acceptLanguage);
  }
  return decideRootRedirect({
    headers,
    isSchoolHost,
    url: new URL(address),
  });
};

/** The location of a root redirect that the request answers, or none. */
const rootLocationOf = (
  address: string,
  acceptLanguage?: string,
  isSchoolHost = false
) =>
  decideRoot(address, acceptLanguage, isSchoolHost).pipe(
    Option.map((d) => d.location)
  );

/** The spelling redirect decided for one address on a main or a school host. */
const decideSpelling = (address: string, isSchoolHost = false) =>
  decideSpellingRedirect({ isSchoolHost, url: new URL(address) });

describe("root redirect", () => {
  it("answers the root with the default locale and a 307 that varies", () => {
    expect(decideRoot("https://nakafa.com/")).toStrictEqual(
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
    expect(decideRoot("https://nakafa.com/", header)).toStrictEqual(
      Option.some({
        location,
        status: 307,
        vary: "Accept-Language, Cookie",
      })
    );
  });

  it("keeps the query on the root answer", () => {
    expect(rootLocationOf("https://nakafa.com/?utm=x")).toStrictEqual(
      Option.some("/en?utm=x")
    );
  });

  it("leaves a path of slashes to the slash decision, which names the root", () => {
    expect(Option.isNone(decideRoot("https://nakafa.com//"))).toBe(true);
  });

  it("keeps the school home at the root without a locale redirect", () => {
    expect(
      Option.isNone(decideRoot("https://harapan.nakafa.com/", undefined, true))
    ).toBe(true);
  });

  it("uses the locale cookie before Accept-Language", () => {
    const headers = new Headers({
      "accept-language": "id-ID",
      cookie: "NAKAFA_LOCALE=de",
    });
    const decision = decideRootRedirect({
      headers,
      isSchoolHost: false,
      url: new URL("https://nakafa.com/"),
    });
    expect(decision.pipe(Option.map((d) => d.location))).toStrictEqual(
      Option.some("/de")
    );
  });
});

describe("spelling redirect", () => {
  it.each([
    ["https://nakafa.com/en/curricula", "/en/curriculum"],
    ["https://nakafa.com/en/materials/x?tab=1", "/en/subjects/x?tab=1"],
    ["https://nakafa.com/de/curricula/merdeka", "/de/lehrplaene/merdeka"],
    ["https://nakafa.com/id/materials/matematika", "/id/materi/matematika"],
  ])("moves %s to %s with a 308", (address, location) => {
    expect(decideSpelling(address)).toStrictEqual(
      Option.some({ location, status: 308 })
    );
  });

  it.each([
    "https://nakafa.com/en/curriculum",
    "https://nakafa.com/id/materi/matematika",
    "https://nakafa.com/fr/curriculum",
    "https://nakafa.com/id/subjects/matematika",
    "https://nakafa.com/api/ping",
    "https://nakafa.com/",
  ])("leaves %s to the next decision", (address) => {
    expect(Option.isNone(decideSpelling(address))).toBe(true);
  });

  it("leaves a non-public spelling of a school host alone, since a school has no locale", () => {
    expect(
      Option.isNone(
        decideSpelling("https://harapan.nakafa.com/en/curricula", true)
      )
    ).toBe(true);
  });
});

describe("slashes in a path", () => {
  it.each([
    ["https://nakafa.com/en/curriculum/", "/en/curriculum"],
    ["https://nakafa.com/en//curriculum", "/en/curriculum"],
    ["https://nakafa.com/en/curriculum//", "/en/curriculum"],
    ["https://nakafa.com//evil.com/", "/evil.com"],
    ["https://harapan.nakafa.com/exams/", "/exams"],
  ])("moves %s to the single-slash path %s", (address, location) => {
    expect(
      decideSlashRedirect(new URL(address)).pipe(Option.map((d) => d.location))
    ).toStrictEqual(Option.some(location));
  });

  it.each([
    "https://harapan.nakafa.com//evil.com/",
    "https://harapan.nakafa.com///evil.com",
  ])("never answers %s with a protocol-relative location", (address) => {
    expect(
      decideSlashRedirect(new URL(address)).pipe(Option.map((d) => d.location))
    ).toStrictEqual(Option.some("/evil.com"));
  });

  it("answers a path of slashes with the root path, which the root decision then answers", () => {
    expect(decideSlashRedirect(new URL("https://nakafa.com///"))).toStrictEqual(
      Option.some({ location: "/", status: 308 })
    );
  });

  it("keeps the query of a path with slashes", () => {
    expect(
      decideSlashRedirect(new URL("https://nakafa.com/en//curriculum/?page=2"))
    ).toStrictEqual(
      Option.some({ location: "/en/curriculum?page=2", status: 308 })
    );
  });
});

describe("canonical slash spelling", () => {
  it("answers a run of slashes and a trailing slash with the canonical path and its query", () => {
    expect(
      decideSlashRedirect(new URL("https://nakafa.com/en//curriculum/?ref=x"))
    ).toStrictEqual(
      Option.some({ location: "/en/curriculum?ref=x", status: 308 })
    );
  });

  it("leaves a canonical path and a shared path alone", () => {
    expect(
      Option.isNone(
        decideSlashRedirect(new URL("https://nakafa.com/en/curriculum"))
      )
    ).toBe(true);
    expect(
      Option.isNone(
        decideSlashRedirect(new URL("https://nakafa.com/api/ping/"))
      )
    ).toBe(true);
    expect(
      Option.isNone(
        decideSlashRedirect(new URL("https://nakafa.com/robots.txt"))
      )
    ).toBe(true);
  });
});
