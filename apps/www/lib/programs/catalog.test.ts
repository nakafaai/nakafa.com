import { describe, expect, it } from "vitest";
import type {
  ActiveLearningProfile,
  LearningProgramCatalog,
} from "@/components/programs/contract";
import {
  filterOnboardingPrograms,
  shouldRequireLearningProgramOnboarding,
} from "@/lib/programs/catalog";

const activeProfile = {
  interests: ["school-curriculum"],
  planItems: [],
  program: {
    coverageStatus: "available",
    displayOrder: 10,
    key: "ready-curriculum",
    kind: "school-curriculum",
    navigation: {
      levels: ["stage", "class", "subject", "topic"],
      model: "curriculum-tree",
    },
    publicSlug: "ready-curriculum",
    title: "Ready curriculum",
    versionLabel: "2026",
  },
  stage: undefined,
} satisfies NonNullable<ActiveLearningProfile>;

const catalog = [
  {
    coverageStatus: "available",
    displayOrder: 10,
    key: "ready-curriculum",
    kind: "school-curriculum",
    navigation: {
      levels: ["stage", "class", "subject", "topic"],
      model: "curriculum-tree",
    },
    publicSlug: "ready-curriculum",
    title: "Ready curriculum",
    versionLabel: "2026",
  },
  {
    coverageStatus: "planned",
    displayOrder: 20,
    key: "planned-path",
    kind: "school-curriculum",
    navigation: {
      levels: ["stage", "class", "subject", "topic"],
      model: "curriculum-tree",
    },
    publicSlug: "planned-path",
    title: "Planned path",
    versionLabel: "2026",
  },
  {
    coverageStatus: "partial",
    displayOrder: 30,
    key: "partial-path",
    kind: "school-curriculum",
    navigation: {
      levels: ["stage", "class", "subject", "topic"],
      model: "curriculum-tree",
    },
    publicSlug: "partial-path",
    title: "Partial path",
    versionLabel: "2026",
  },
] satisfies LearningProgramCatalog;

describe("programs/catalog", () => {
  it("treats available and partial programs as onboarding-ready", () => {
    expect(
      filterOnboardingPrograms(catalog).map((program) => program.key)
    ).toEqual(["ready-curriculum", "partial-path"]);
  });

  it("does not require onboarding when the locale has no ready programs", () => {
    expect(shouldRequireLearningProgramOnboarding(null, [])).toBe(false);
    expect(
      shouldRequireLearningProgramOnboarding(null, [
        { ...catalog[1], coverageStatus: "planned" },
        { ...catalog[1], coverageStatus: "hidden" },
        { ...catalog[1], coverageStatus: "archived" },
      ])
    ).toBe(false);
  });

  it("requires first-run onboarding only when a missing profile can be created", () => {
    expect(shouldRequireLearningProgramOnboarding(null, catalog)).toBe(true);
    expect(shouldRequireLearningProgramOnboarding(activeProfile, catalog)).toBe(
      false
    );
  });
});
