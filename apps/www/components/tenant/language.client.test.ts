// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import {
  changeSchoolLanguage,
  LanguageSaveFailed,
} from "@/components/tenant/language.client";

const doubles = vi.hoisted(() => ({
  report: vi.fn(),
  save: vi.fn(),
}));

vi.mock("@/components/tenant/language", () => ({
  saveSchoolLanguage: doubles.save,
}));
vi.mock("@/lib/analytics/client", () => ({
  reportClientException: doubles.report,
}));

describe("changeSchoolLanguage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    doubles.report.mockReturnValue(Effect.void);
  });

  it.effect("fails for an unknown locale without saving it", () =>
    Effect.gen(function* () {
      const failure = yield* changeSchoolLanguage("fr").pipe(Effect.flip);

      expect(failure).toBeInstanceOf(LanguageSaveFailed);
      expect(doubles.save).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "saves the chosen language and renders the page again in place",
    () =>
      Effect.gen(function* () {
        doubles.save.mockResolvedValue(undefined);

        const render = yield* changeSchoolLanguage("id");

        expect(render).toBe("refresh");
        expect(doubles.save).toHaveBeenCalledExactlyOnceWith({ data: "id" });
        expect(doubles.report).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "reports a failed save and answers failed, so the page keeps its language",
    () =>
      Effect.gen(function* () {
        const failure = new Error("network");
        doubles.save.mockRejectedValue(failure);

        const render = yield* changeSchoolLanguage("de");

        expect(render).toBe("failed");
        expect(doubles.report).toHaveBeenCalledExactlyOnceWith(failure, {
          source: "school-language",
        });
      })
  );
});
