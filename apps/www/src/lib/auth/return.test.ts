// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { defaultParseSearch } from "@tanstack/react-router";
import { Option } from "effect";
import {
  googleReturnAddress,
  mainSignInAddress,
  readAuthReturnQuery,
  readSchoolReturn,
} from "@/lib/auth/return";

describe("readAuthReturnQuery", () => {
  it("reads the destination and the school of the address", () => {
    expect(
      readAuthReturnQuery({
        other: "value",
        redirect: "/en/home",
        school: "https://harapan.nakafa.com/",
      })
    ).toEqual({ redirect: "/en/home", school: "https://harapan.nakafa.com/" });
  });

  it("keeps a numeric value as the text the address carries", () => {
    expect(readAuthReturnQuery({ redirect: 123 })).toEqual({ redirect: "123" });
  });

  it("reads an absent key as absent, and a repeated key as absent", () => {
    expect(readAuthReturnQuery({})).toEqual({});
    expect(readAuthReturnQuery({ redirect: ["/a", "/b"] })).toEqual({});
  });

  it("reads the address the router parses, where a repeated key stays absent", () => {
    expect(
      readAuthReturnQuery(defaultParseSearch("?redirect=%2Fa&redirect=%2Fb"))
    ).toEqual({});
    expect(
      readAuthReturnQuery(defaultParseSearch("?redirect=%2Fen%2Fhome"))
    ).toEqual({ redirect: "/en/home" });
  });
});

describe("readSchoolReturn", () => {
  const production = new URL("https://nakafa.com/en/auth");
  const local = new URL("http://localhost:3000/en/auth");

  it("reads a school address beside the main site", () => {
    expect(
      readSchoolReturn("https://harapan.nakafa.com/kelas?x=1", production)
    ).toEqual(Option.some("https://harapan.nakafa.com/kelas?x=1"));
    expect(
      readSchoolReturn("http://harapan.localhost:3000/", local)
    ).toEqual(Option.some("http://harapan.localhost:3000/"));
  });

  it("refuses any address that is not a school beside the main site", () => {
    for (const text of [
      undefined,
      "not an address",
      "https://evil.example/",
      "https://harapan.nakafa.com.evil.example/",
      "http://harapan.nakafa.com/",
      "https://harapan.nakafa.com:8443/",
      "https://school.nakafa.com/",
      "https://a.b.nakafa.com/",
    ]) {
      expect(readSchoolReturn(text, production)).toEqual(Option.none());
    }
    expect(
      readSchoolReturn("http://harapan.localhost:3001/", local)
    ).toEqual(Option.none());
  });
});

describe("mainSignInAddress", () => {
  it("names the main site's sign-in page with the school to return to", () => {
    const school = new URL("http://harapan.localhost:3000/en/kelas?tab=1");
    expect(mainSignInAddress(school, "en")).toEqual(
      Option.some(
        `http://localhost:3000/en/auth?school=${encodeURIComponent(school.href)}`
      )
    );
    expect(
      mainSignInAddress(new URL("https://harapan.nakafa.com/"), "id")
    ).toEqual(
      Option.some(
        "https://nakafa.com/id/auth?school=https%3A%2F%2Fharapan.nakafa.com%2F"
      )
    );
  });

  it("names none for a host outside the school domains", () => {
    expect(
      mainSignInAddress(new URL("https://example.org/"), "en")
    ).toEqual(Option.none());
  });
});

describe("googleReturnAddress", () => {
  it("returns to the sign-in page of the starting origin with the intent and the school", () => {
    expect(
      googleReturnAddress({
        intent: "/en/chat/chat-id",
        locale: "en",
        origin: "http://localhost:3000",
        school: Option.none(),
      })
    ).toBe("http://localhost:3000/en/auth?redirect=%2Fen%2Fchat%2Fchat-id");
    expect(
      googleReturnAddress({
        intent: undefined,
        locale: "id",
        origin: "https://nakafa.com",
        school: Option.some("https://harapan.nakafa.com/"),
      })
    ).toBe(
      "https://nakafa.com/id/auth?school=https%3A%2F%2Fharapan.nakafa.com%2F"
    );
  });
});
