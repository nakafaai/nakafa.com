// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { readAuthReturnQuery } from "@/lib/auth/return";

describe("readAuthReturnQuery", () => {
  it("reads the destination and the provider failure of the address", () => {
    expect(
      readAuthReturnQuery("?redirect=%2Fen%2Fhome&error=oauth&other=value")
    ).toEqual({ error: "oauth", redirect: "/en/home" });
  });

  it("keeps a numeric value as the text the address carries", () => {
    expect(readAuthReturnQuery("?redirect=123")).toEqual({ redirect: "123" });
  });

  it("reads an absent key as absent, and a repeated key as absent", () => {
    expect(readAuthReturnQuery("")).toEqual({});
    expect(readAuthReturnQuery("?redirect=%2Fa&redirect=%2Fb")).toEqual({});
  });
});
