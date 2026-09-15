import { describe, expect, it } from "@effect/vitest";
import {
  getForYouNavigationHref,
  getForYouNavigationItems,
} from "@/components/sidebar/data/navigation";

describe("sidebar navigation", () => {
  it("returns the shared primary actions in display order", () => {
    expect(getForYouNavigationItems().map((item) => item.id)).toEqual([
      "subject",
      "tryOut",
      "askNina",
    ]);
  });

  it("uses localized hrefs only when a navigation item owns them", () => {
    const [subject, tryOut, askNina] = getForYouNavigationItems();

    expect(subject).toBeDefined();
    expect(tryOut).toBeDefined();
    expect(askNina).toBeDefined();
    expect(getForYouNavigationHref(subject, "id")).toBe("/kurikulum");
    expect(getForYouNavigationHref(subject, "en")).toBe("/curriculum");
    expect(
      getForYouNavigationHref(subject, "id", {
        preferredCurriculumHref: "/kurikulum/amerika-serikat",
      })
    ).toBe("/kurikulum/amerika-serikat");
    expect(
      getForYouNavigationHref(tryOut, "id", {
        preferredTryoutHref: "/try-out/indonesia",
      })
    ).toBe("/try-out/indonesia");
    expect(getForYouNavigationHref(askNina, "id")).toBe("/chat");
  });
});
