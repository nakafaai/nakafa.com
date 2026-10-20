import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import {
  getForYouNavigationItems,
  getForYouNavigationTarget,
} from "@/components/sidebar/data/navigation";

describe("sidebar navigation", () => {
  it("returns the shared primary actions in display order", () => {
    expect(Arr.map(getForYouNavigationItems(), (item) => item.id)).toEqual([
      "subject",
      "tryOut",
      "askNina",
    ]);
  });

  it("routes each primary action to its own route on the locale", () => {
    const [subject, tryOut, askNina] = getForYouNavigationItems();

    expect(subject).toBeDefined();
    expect(tryOut).toBeDefined();
    expect(askNina).toBeDefined();
    expect(getForYouNavigationTarget(subject, "id")).toEqual({
      params: { locale: "id" },
      to: "/$locale/curricula",
    });
    expect(getForYouNavigationTarget(tryOut, "en")).toEqual({
      params: { locale: "en" },
      to: "/$locale/try-out",
    });
    expect(getForYouNavigationTarget(askNina, "id")).toEqual({
      params: { locale: "id" },
      to: "/$locale/chat",
    });
  });

  it("uses a learner's stored path only for the row that it names", () => {
    const [subject, tryOut, askNina] = getForYouNavigationItems();

    expect(
      getForYouNavigationTarget(subject, "id", {
        preferredCurriculumHref: "/kurikulum/amerika-serikat",
      })
    ).toBe("/kurikulum/amerika-serikat");
    expect(
      getForYouNavigationTarget(tryOut, "id", {
        preferredTryoutHref: "/try-out/indonesia",
      })
    ).toBe("/try-out/indonesia");
    expect(
      getForYouNavigationTarget(askNina, "id", {
        preferredCurriculumHref: "/kurikulum/amerika-serikat",
      })
    ).toEqual({ params: { locale: "id" }, to: "/$locale/chat" });
  });
});
