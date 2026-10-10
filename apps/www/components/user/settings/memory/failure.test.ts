import { afterEach, describe, expect, it } from "@effect/vitest";
import { captureException } from "@repo/analytics/posthog/browser";
import { NinaMemoryRejected } from "@repo/backend/confect/nina/memory.spec";
import { Effect } from "effect";
import { toast } from "sonner";
import { reportMemoryFailure } from "@/components/user/settings/memory/failure";

vi.mock("@repo/analytics/posthog/browser", () => ({
  captureException: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

afterEach(() => vi.clearAllMocks());

const messages = {
  limit: "You can keep up to 100 memories.",
  missing: "This memory no longer exists.",
  other: "We could not complete this action.",
};

describe("memory failure", () => {
  it.effect("explains a full list without reporting it", () =>
    Effect.gen(function* () {
      const again = yield* reportMemoryFailure(
        new NinaMemoryRejected({ reason: "limit" }),
        messages
      );

      expect(toast.error).toHaveBeenCalledExactlyOnceWith(messages.limit);
      expect(captureException).not.toHaveBeenCalled();
      expect(again).toBe(true);
    })
  );

  it.effect("explains a deleted memory and cannot try the change again", () =>
    Effect.gen(function* () {
      const again = yield* reportMemoryFailure(
        new NinaMemoryRejected({ reason: "missing" }),
        messages
      );

      expect(toast.error).toHaveBeenCalledExactlyOnceWith(messages.missing);
      expect(captureException).not.toHaveBeenCalled();
      expect(again).toBe(false);
    })
  );

  it.effect(
    "reports a failure nobody expected and shows the general words",
    () =>
      Effect.gen(function* () {
        const error = new Error("The connection dropped.");
        const again = yield* reportMemoryFailure(error, messages);

        expect(captureException).toHaveBeenCalledExactlyOnceWith(error, {
          source: "components/user/settings/memory",
        });
        expect(toast.error).toHaveBeenCalledExactlyOnceWith(messages.other);
        expect(again).toBe(true);
      })
  );
});
