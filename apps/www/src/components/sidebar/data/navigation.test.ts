import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Option } from "effect";
import {
  getPrimaryNavigationItems,
  getPrimaryNavigationTarget,
} from "@/components/sidebar/data/navigation";
import { getTryoutPublicPathTarget } from "@/components/tryout/route/path";
import { getCurriculumProgramTarget } from "@/lib/curriculum/routes";

describe("sidebar navigation", () => {
  it("returns the shared primary actions in display order", () => {
    expect(Arr.map(getPrimaryNavigationItems(), (item) => item.id)).toEqual([
      "subject",
      "tryOut",
      "askNina",
    ]);
  });

  it("routes each primary action to its own route, on the locale of the page", () => {
    const [subject, tryOut, askNina] = getPrimaryNavigationItems();

    expect(getPrimaryNavigationTarget(subject)).toEqual({
      from: "/$locale",
      to: "/$locale/curricula",
    });
    expect(getPrimaryNavigationTarget(tryOut)).toEqual({
      from: "/$locale",
      to: "/$locale/try-out",
    });
    expect(getPrimaryNavigationTarget(askNina)).toEqual({
      from: "/$locale",
      to: "/$locale/chat",
    });
  });

  it("uses a learner's stored target only for the row that it names", () => {
    const [subject, tryOut, askNina] = getPrimaryNavigationItems();
    const curriculumTarget = getCurriculumProgramTarget("amerika-serikat");
    const tryoutTarget = getTryoutPublicPathTarget("try-out/indonesia");

    expect(
      getPrimaryNavigationTarget(subject, {
        preferredCurriculumTarget: Option.some(curriculumTarget),
      })
    ).toEqual(curriculumTarget);
    expect(
      getPrimaryNavigationTarget(tryOut, {
        preferredTryoutTarget: tryoutTarget,
      })
    ).toEqual(Option.getOrThrow(tryoutTarget));
    expect(
      getPrimaryNavigationTarget(askNina, {
        preferredCurriculumTarget: Option.some(curriculumTarget),
      })
    ).toEqual({ from: "/$locale", to: "/$locale/chat" });
  });
});
