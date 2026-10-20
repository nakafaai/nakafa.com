import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import {
  getForYouNavigationItems,
  getForYouNavigationTarget,
} from "@/components/sidebar/data/navigation";
import { getTryoutCountryTarget } from "@/components/tryout/route/path";
import { getCurriculumProgramTarget } from "@/lib/curriculum/routes";

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

  it("uses a learner's stored target only for the row that it names", () => {
    const [subject, tryOut, askNina] = getForYouNavigationItems();
    const curriculumTarget = getCurriculumProgramTarget({
      locale: "id",
      publicSlug: "amerika-serikat",
    });
    const tryoutTarget = getTryoutCountryTarget("id", "try-out/indonesia");

    expect(
      getForYouNavigationTarget(subject, "id", {
        preferredCurriculumTarget: curriculumTarget,
      })
    ).toEqual({
      params: { _splat: "", curriculum: "amerika-serikat", locale: "id" },
      to: "/$locale/curricula/$curriculum/$",
    });
    expect(
      getForYouNavigationTarget(tryOut, "id", {
        preferredTryoutTarget: tryoutTarget,
      })
    ).toEqual({
      params: { country: "indonesia", locale: "id" },
      to: "/$locale/try-out/$country",
    });
    expect(
      getForYouNavigationTarget(askNina, "id", {
        preferredCurriculumTarget: curriculumTarget,
      })
    ).toEqual({ params: { locale: "id" }, to: "/$locale/chat" });
  });
});
