// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { changeSchoolLanguage } from "@/components/tenant/language.client";

const doubles = vi.hoisted(() => ({
  isStaleAction: vi.fn(),
  reload: vi.fn(),
  report: vi.fn(),
  save: vi.fn(),
}));

vi.mock("@/components/tenant/language", () => ({
  saveSchoolLanguage: doubles.save,
}));
vi.mock("@/lib/analytics/client", () => ({
  reportClientException: doubles.report,
}));
vi.mock("next/navigation", () => ({
  unstable_isUnrecognizedActionError: doubles.isStaleAction,
}));

describe("changeSchoolLanguage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("window", { location: { reload: doubles.reload } });
    doubles.report.mockReturnValue(Effect.void);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.effect("saves the chosen language and then reloads the page", () =>
    Effect.gen(function* () {
      doubles.save.mockResolvedValue(undefined);

      yield* changeSchoolLanguage("id");

      expect(doubles.save).toHaveBeenCalledExactlyOnceWith("id");
      expect(doubles.reload).toHaveBeenCalledOnce();
      expect(doubles.report).not.toHaveBeenCalled();
    })
  );

  it.effect("reports a failed save and still reloads the page", () =>
    Effect.gen(function* () {
      const failure = new Error("network");
      doubles.save.mockRejectedValue(failure);
      doubles.isStaleAction.mockReturnValue(false);

      yield* changeSchoolLanguage("de");

      expect(doubles.report).toHaveBeenCalledExactlyOnceWith(failure, {
        source: "school-language",
      });
      expect(doubles.reload).toHaveBeenCalledOnce();
    })
  );

  it.effect("reloads a tab that runs an old build without reporting it", () =>
    Effect.gen(function* () {
      const stale = new Error("Failed to find Server Action");
      doubles.save.mockRejectedValue(stale);
      doubles.isStaleAction.mockReturnValue(true);

      yield* changeSchoolLanguage("de");

      expect(doubles.isStaleAction).toHaveBeenCalledExactlyOnceWith(stale);
      expect(doubles.report).not.toHaveBeenCalled();
      expect(doubles.reload).toHaveBeenCalledOnce();
    })
  );
});
