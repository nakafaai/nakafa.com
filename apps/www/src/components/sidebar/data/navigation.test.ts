import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Option } from "effect";
import {
  getForYouNavigationItems,
  getForYouNavigationTarget,
} from "@/components/sidebar/data/navigation";
import { getTryoutPublicPathTarget } from "@/components/tryout/route/path";
import { getCurriculumProgramTarget } from "@/lib/curriculum/routes";

describe("sidebar navigation", () => {
  it("returns the shared primary actions in display order", () => {
    expect(Arr.map(getForYouNavigationItems(), (item) => item.id)).toEqual([
      "subject",
      "tryOut",
      "askNina",
    ]);
  });

  it("routes each primary action to its own route, on the locale of the page", () => {
    const [subject, tryOut, askNina] = getForYouNavigationItems();

    expect(getForYouNavigationTarget(subject)).toEqual({
      from: "/$locale",
      to: "/$locale/curricula",
    });
    expect(getForYouNavigationTarget(tryOut)).toEqual({
      from: "/$locale",
      to: "/$locale/try-out",
    });
    expect(getForYouNavigationTarget(askNina)).toEqual({
      from: "/$locale",
      to: "/$locale/chat",
    });
  });

  it("uses a learner's stored target only for the row that it names", () => {
    const [subject, tryOut, askNina] = getForYouNavigationItems();
    const curriculumTarget = getCurriculumProgramTarget("amerika-serikat");
    const tryoutTarget = getTryoutPublicPathTarget("try-out/indonesia");

    expect(
      getForYouNavigationTarget(subject, {
        preferredCurriculumTarget: Option.some(curriculumTarget),
      })
    ).toEqual(curriculumTarget);
    expect(
      getForYouNavigationTarget(tryOut, {
        preferredTryoutTarget: tryoutTarget,
      })
    ).toEqual(Option.getOrThrow(tryoutTarget));
    expect(
      getForYouNavigationTarget(askNina, {
        preferredCurriculumTarget: Option.some(curriculumTarget),
      })
    ).toEqual({ from: "/$locale", to: "/$locale/chat" });
  });
});
