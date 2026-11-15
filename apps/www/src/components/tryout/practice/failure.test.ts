import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { reportPracticeFailure } from "@/components/tryout/practice/failure";

const mocks = vi.hoisted(() => ({ report: vi.fn(), toast: vi.fn() }));

vi.mock("@repo/design-system/lib/toast/notify", () => ({
  toast: { error: mocks.toast },
}));

vi.mock("@/lib/analytics/client", async () => {
  const { Effect: Fx } = await import("effect");
  return {
    reportClientException: (error: unknown, properties: unknown) =>
      Fx.sync(() => mocks.report(error, properties)),
  };
});

describe("reportPracticeFailure", () => {
  it.effect("tells the learner and reports the failure with its source", () =>
    Effect.gen(function* () {
      const failure = new Error("offline");

      yield* reportPracticeFailure(failure);

      expect(mocks.toast).toHaveBeenCalledExactlyOnceWith(
        {
          description: "practice-failed.description",
          title: "practice-failed.title",
        },
        { position: "bottom-center" }
      );
      expect(mocks.report).toHaveBeenCalledExactlyOnceWith(failure, {
        source: "tryout-practice",
      });
    })
  );
});
