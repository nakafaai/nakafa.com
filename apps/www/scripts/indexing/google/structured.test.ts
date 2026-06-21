import { describe, expect, it } from "vitest";
import { hasGoogleIndexingApiEligibleStructuredData } from "@/scripts/indexing/google/structured";

describe("hasGoogleIndexingApiEligibleStructuredData", () => {
  it("accepts JobPosting JSON-LD because Google Indexing API supports job pages", () => {
    expect(
      hasGoogleIndexingApiEligibleStructuredData({
        "@context": "https://schema.org",
        "@type": "JobPosting",
        title: "Teacher",
      })
    ).toBe(true);
  });

  it("accepts BroadcastEvent only when it is inside VideoObject JSON-LD", () => {
    expect(
      hasGoogleIndexingApiEligibleStructuredData({
        "@context": "https://schema.org",
        "@type": "VideoObject",
        publication: {
          "@type": "BroadcastEvent",
          isLiveBroadcast: true,
        },
      })
    ).toBe(true);

    expect(
      hasGoogleIndexingApiEligibleStructuredData({
        "@context": "https://schema.org",
        "@type": ["Course", "JobPosting"],
        title: "Teacher",
      })
    ).toBe(true);
  });

  it("rejects normal education and article JSON-LD so general pages rely on sitemap discovery", () => {
    expect(
      hasGoogleIndexingApiEligibleStructuredData([
        {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "Belajar vektor",
        },
        {
          "@context": "https://schema.org",
          "@type": "Course",
          name: "Matematika",
        },
      ])
    ).toBe(false);

    expect(
      hasGoogleIndexingApiEligibleStructuredData({
        "@context": "https://schema.org",
        "@type": "BroadcastEvent",
        name: "Standalone livestream event is not nested in a video",
      })
    ).toBe(false);

    expect(hasGoogleIndexingApiEligibleStructuredData("Article")).toBe(false);

    expect(
      hasGoogleIndexingApiEligibleStructuredData({
        "@context": "https://schema.org",
        name: "Structured data without a supported type",
      })
    ).toBe(false);
  });
});
