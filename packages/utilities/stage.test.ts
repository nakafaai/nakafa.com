import { describe, expect, it } from "@effect/vitest";
import { deployStageKeys } from "@repo/utilities/stage";

describe("deployStageKeys", () => {
  it("keeps an unset stage undefined, because a local run binds no stage", () => {
    vi.stubEnv("NAKAFA_DEPLOY_STAGE", undefined);

    expect(deployStageKeys()).toEqual({ NAKAFA_DEPLOY_STAGE: undefined });
  });

  it("reads the bound stage as text, whatever its name", () => {
    vi.stubEnv("NAKAFA_DEPLOY_STAGE", "pr-42");

    expect(deployStageKeys()).toEqual({ NAKAFA_DEPLOY_STAGE: "pr-42" });
  });
});
