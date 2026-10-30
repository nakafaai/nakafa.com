import { describe, expect, it } from "@effect/vitest";
import { connectCallback } from "@/components/connectors/address";

describe("connectCallback", () => {
  it("names the site's callback from the site and from a school host under it", () => {
    expect(
      connectCallback({ host: "nakafa.com", protocol: "https:" }, null)
    ).toBe("https://nakafa.com/api/connectors/google/callback");
    expect(
      connectCallback(
        { host: "harapan.nakafa.com", protocol: "https:" },
        "harapan"
      )
    ).toBe("https://nakafa.com/api/connectors/google/callback");
    expect(
      connectCallback({ host: "localhost:3000", protocol: "http:" }, "harapan")
    ).toBe("http://localhost:3000/api/connectors/google/callback");
  });
});
