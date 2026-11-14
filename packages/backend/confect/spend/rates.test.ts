import { describe, expect, it } from "@effect/vitest";
import {
  buffered,
  decisionCost,
  embeddingCost,
  languageCeiling,
  languageCost,
  reportedCost,
  scrapeCost,
  searchCost,
  tokenBound,
  vendorOf,
} from "@repo/backend/confect/spend/rates";

describe("spend/rates", () => {
  it("prices a Haiku call at the public rates with the 25% margin", () => {
    // 10,000 uncached prompt tokens at $0.10 and 1,000 output tokens at $0.50
    // per million: 1,000 + 500 micro-dollars, 1,875 with the margin.
    expect(
      languageCost({ input: 10_000, output: 1000, cacheRead: 0, cacheWrite: 0 })
    ).toBe(1875);
  });

  it("prices cached prompt tokens at the cache rates", () => {
    // 2,000 uncached at $0.10, 4,000 read at $0.01, 4,000 written at $0.125:
    // 200 + 40 + 500 micro-dollars, 925 with the margin.
    expect(
      languageCost({
        input: 10_000,
        output: 0,
        cacheRead: 4000,
        cacheWrite: 4000,
      })
    ).toBe(925);
  });

  it("charges five times every rate above a 100,000-token prompt", () => {
    // 100,001 tokens at $0.50 per million: 50,000.5, then x1.25, rounded up.
    expect(
      languageCost({ input: 100_001, output: 0, cacheRead: 0, cacheWrite: 0 })
    ).toBe(62_501);
    expect(
      languageCost({ input: 100_000, output: 0, cacheRead: 0, cacheWrite: 0 })
    ).toBe(12_500);
  });

  it("holds a whole prompt written to the cache and the purpose's output cap", () => {
    // Chat: 100,000 cache writes at $0.125 and 48,000 output at $0.50 per
    // million: 12,500 + 24,000 micro-dollars, 45,625 with the margin.
    expect(languageCeiling("chat")).toBe(45_625);
    // Import: 12,500 + 16,384 x 0.5 = 20,692, 25,865 with the margin.
    expect(languageCeiling("import")).toBe(25_865);
  });

  it("takes a reported cost as the bill, rounded up to a micro-dollar", () => {
    expect(reportedCost(0.001_234_5)).toBe(1235);
    expect(reportedCost(0.001_25)).toBe(1250);
    expect(reportedCost(0)).toBe(0);
  });

  it("prices a decision, an embedding and the Firecrawl calls", () => {
    // 1,000 Jev tokens at $0.042: 42, then 52.5, rounded up.
    expect(decisionCost(1000)).toBe(53);
    // 1,000 embedding tokens at $0.20: 200, 250 with the margin.
    expect(embeddingCost(1000)).toBe(250);
    // Ten results are one unit of 2 credits at $0.005: 10,000, 12,500 with the margin.
    expect(searchCost(10)).toBe(12_500);
    // Eleven results round up to two units.
    expect(searchCost(11)).toBe(25_000);
    expect(scrapeCost()).toBe(6250);
  });

  it("bounds a text's tokens by its UTF-8 bytes", () => {
    expect(tokenBound("Nakafa")).toBe(6);
    expect(tokenBound("数学")).toBe(6);
  });

  it("names the vendor of each kind of work", () => {
    expect(vendorOf("chat")).toBe("anthropic");
    expect(vendorOf("import")).toBe("anthropic");
    expect(vendorOf("decision")).toBe("typesafe");
    expect(vendorOf("embedding")).toBe("google");
    expect(vendorOf("search")).toBe("firecrawl");
    expect(vendorOf("scrape")).toBe("firecrawl");
  });

  it("turns direct cost into credits of US$0.002, rounded up", () => {
    expect(buffered(3)).toBe(4);
  });
});
