import { describe, expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import { reportClientException } from "@/lib/analytics/client";
import { reportDropped } from "@/lib/editor/report";
import { SyncDropped } from "@/lib/editor/session";

vi.mock("@/lib/analytics/client", async () => {
  const { Effect: Eff } = await import("effect");
  return { reportClientException: vi.fn(() => Eff.void) };
});

describe("reportDropped", () => {
  it.effect(
    "reports the steps an editor lost, once, as a typed SyncDropped",
    () =>
      Effect.gen(function* () {
        vi.mocked(reportClientException).mockClear();
        const dropped = new SyncDropped({ count: 2 });

        yield* reportDropped(
          Option.some(dropped),
          "components/tenant/exams/text"
        );

        expect(reportClientException).toHaveBeenCalledTimes(1);
        expect(reportClientException).toHaveBeenCalledWith(dropped, {
          source: "components/tenant/exams/text",
        });
      })
  );

  it.effect("reports nothing when no step was lost", () =>
    Effect.gen(function* () {
      vi.mocked(reportClientException).mockClear();

      yield* reportDropped(Option.none(), "components/tenant/exams/text");

      expect(reportClientException).not.toHaveBeenCalled();
    })
  );
});
