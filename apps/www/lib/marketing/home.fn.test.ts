// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Option, Schema } from "effect";
import { readFeaturedTryout } from "@/components/tryout/catalog/server";
import { HomeInput, readHomeTryoutHandler } from "@/lib/marketing/home.fn";

process.env.VITE_CONVEX_URL = "https://example.convex.cloud";

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => new Request("https://nakafa.com/en"),
}));

vi.mock("@/components/tryout/catalog/server", () => ({
  readFeaturedTryout: vi.fn(() => Promise.resolve({ title: "Featured" })),
}));

describe("home page input", () => {
  it("accepts a locale that the contracts name and refuses any other", () => {
    const decode = Schema.decodeUnknownOption(HomeInput);
    expect(Option.isSome(decode({ locale: "id" }))).toBe(true);
    expect(Option.isNone(decode({ locale: "fr" }))).toBe(true);
  });

  it("reads the featured try-out of the requested locale", async () => {
    const value = await readHomeTryoutHandler({ data: { locale: "de" } });
    expect(value).toStrictEqual({ title: "Featured" });
    expect(readFeaturedTryout).toHaveBeenCalledWith("de");
  });
});
