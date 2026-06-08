// @vitest-environment node
import { describe, expect, it } from "vitest";
import robots from "@/app/robots";

describe("robots metadata", () => {
  it("advertises the canonical sitemap index instead of expanding page ids", () => {
    const metadata = robots();

    expect(metadata.sitemap).toBe("https://nakafa.com/sitemap.xml");
    expect(metadata.sitemap).not.toContain(
      "https://nakafa.com/sitemap/base.xml"
    );
    expect(metadata.sitemap).not.toContain("nakafa.id");
  });
});
