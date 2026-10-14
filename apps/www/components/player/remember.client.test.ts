import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { rememberPlayerMode } from "@/components/player/remember.client";

const mocks = vi.hoisted(() => ({ report: vi.fn(), save: vi.fn() }));

vi.mock("@/components/player/preference", () => ({
  savePlayerMode: mocks.save,
}));

vi.mock("@/lib/analytics/client", async () => {
  const { Effect: Fx } = await import("effect");
  return {
    reportClientException: (error: unknown, properties: unknown) =>
      Fx.sync(() => mocks.report(error, properties)),
  };
});

describe("rememberPlayerMode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(null, "", "/section?attemptId=attempt-id");
  });

  it.effect("saves the view and reports that it was saved", () =>
    Effect.gen(function* () {
      mocks.save.mockResolvedValue(undefined);

      const saved = yield* rememberPlayerMode("single");

      expect(saved).toBe(true);
      expect(mocks.save).toHaveBeenCalledExactlyOnceWith("single");
      expect(mocks.report).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "keeps a view parameter in the address in step with the saved view",
    () =>
      Effect.gen(function* () {
        mocks.save.mockResolvedValue(undefined);
        window.history.replaceState(
          null,
          "",
          "/section?attemptId=attempt-id&view=list#question-3"
        );

        yield* rememberPlayerMode("single");

        expect(window.location.search).toBe(
          "?attemptId=attempt-id&view=single"
        );
        expect(window.location.hash).toBe("#question-3");
      })
  );

  it.effect("leaves an address without a view parameter as it is", () =>
    Effect.gen(function* () {
      mocks.save.mockResolvedValue(undefined);

      yield* rememberPlayerMode("single");

      expect(window.location.search).toBe("?attemptId=attempt-id");
    })
  );

  it.effect(
    "reports a view that could not be saved and leaves the address",
    () =>
      Effect.gen(function* () {
        mocks.save.mockRejectedValue(new Error("offline"));
        window.history.replaceState(
          null,
          "",
          "/section?attemptId=attempt-id&view=list"
        );

        const saved = yield* rememberPlayerMode("single");

        expect(saved).toBe(false);
        expect(mocks.report).toHaveBeenCalledExactlyOnceWith(
          expect.anything(),
          { source: "player-view" }
        );
        expect(window.location.search).toBe("?attemptId=attempt-id&view=list");
      })
  );
});
