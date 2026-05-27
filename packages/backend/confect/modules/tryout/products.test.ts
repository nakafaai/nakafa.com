import { GenericId } from "@confect/core";
import {
  isTryoutProduct,
  primaryTryoutProduct,
  tryoutProductPolicies,
  tryoutProducts,
} from "@repo/backend/confect/modules/tryout/products";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

const exerciseSetId = (value: string) =>
  Schema.decodeUnknownSync(GenericId.GenericId("exerciseSets"))(value);

const makeSet = (material: string, questionCount: number) => ({
  _id: exerciseSetId(`exerciseSets:${material}`),
  exerciseType: "try-out",
  material,
  questionCount,
  setName: "set-1",
  slug: `exercises/high-school/snbt/${material}/try-out/2026/set-1`,
  title: "SNBT Set 1",
  type: "snbt",
});

describe("tryout products", () => {
  it("exposes the supported product and route guard", () => {
    expect(tryoutProducts).toStrictEqual(["snbt"]);
    expect(primaryTryoutProduct).toBe("snbt");
    expect(isTryoutProduct("snbt")).toBe(true);
    expect(isTryoutProduct("unknown")).toBe(false);
  });

  it("detects complete SNBT tryouts and orders parts by policy", () => {
    const policy = tryoutProductPolicies.snbt;
    const detected = policy.detectTryouts({
      locale: "id",
      requiredPartKeys: ["mathematics", "english-language"],
      sets: [makeSet("english-language", 5), makeSet("mathematics", 10)],
    });

    expect(detected).toStrictEqual([
      {
        product: "snbt",
        locale: "id",
        cycleKey: "2026",
        label: "SNBT Set 1",
        slug: "2026-set-1",
        partCount: 2,
        totalQuestionCount: 15,
        isActive: true,
        parts: [
          {
            partKey: "mathematics",
            setId: exerciseSetId("exerciseSets:mathematics"),
          },
          {
            partKey: "english-language",
            setId: exerciseSetId("exerciseSets:english-language"),
          },
        ],
      },
    ]);
  });

  it("ignores incomplete or non-SNBT candidate sets", () => {
    const policy = tryoutProductPolicies.snbt;
    const detected = policy.detectTryouts({
      locale: "en",
      requiredPartKeys: ["mathematics", "english-language"],
      sets: [
        { ...makeSet("mathematics", 10), type: "tka" },
        { ...makeSet("mathematics", 10), exerciseType: "quiz" },
        { ...makeSet("mathematics", 10), slug: "exercises/no-year" },
        makeSet("mathematics", 10),
        makeSet("english-language", 0),
      ],
    });

    expect(detected).toStrictEqual([]);
  });

  it("formats leaderboard namespaces, scoring, time limits, and sort order", () => {
    const policy = tryoutProductPolicies.snbt;
    const detected = policy.detectTryouts({
      locale: "id",
      requiredPartKeys: ["mathematics"],
      sets: [
        { ...makeSet("mathematics", 1), setName: "set-b", title: "B" },
        {
          ...makeSet("mathematics", 1),
          setName: "set-a",
          title: "A",
          slug: "exercises/high-school/snbt/mathematics/try-out/2027/set-a",
        },
      ],
    });

    expect(
      [...detected].sort(policy.compareTryouts).map((item) => item.slug)
    ).toStrictEqual(["2027-set-a", "2026-set-b"]);
    expect(
      policy.getLeaderboardNamespace({
        product: "snbt",
        locale: "id",
        cycleKey: "2026",
      })
    ).toBe("snbt:id:2026");
    expect(policy.getPartTimeLimitSeconds(2)).toBe(180);
    expect(policy.scaleThetaToScore(-10)).toBe(0);
    expect(policy.scaleThetaToScore(0)).toBe(500);
    expect(policy.scaleThetaToScore(10)).toBe(1000);
    expect(() => policy.getPartTimeLimitSeconds(0)).toThrow(
      "questionCount must be greater than 0."
    );
  });

  it("sorts same-cycle tryouts by label and slug", () => {
    const policy = tryoutProductPolicies.snbt;
    const detected = policy.detectTryouts({
      locale: "id",
      requiredPartKeys: ["mathematics"],
      sets: [
        { ...makeSet("mathematics", 1), setName: "set-c", title: "A" },
        { ...makeSet("mathematics", 1), setName: "set-b", title: "B" },
        { ...makeSet("mathematics", 1), setName: "set-a", title: "A" },
      ],
    });

    expect(
      [...detected].sort(policy.compareTryouts).map((item) => item.slug)
    ).toStrictEqual(["2026-set-a", "2026-set-c", "2026-set-b"]);
  });
});
