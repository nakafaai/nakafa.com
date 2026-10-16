import { afterEach, describe, expect, it } from "@effect/vitest";
import { captureException } from "@repo/analytics/posthog/browser";
import { NinaMemoryRejected } from "@repo/backend/confect/nina/memory.spec";
import { type ToastCopy, toast } from "@repo/design-system/lib/toast/notify";
import { Effect } from "effect";
import { reportMemoryFailure } from "@/components/user/settings/memory/failure";

vi.mock("@repo/analytics/posthog/browser", () => ({
  captureException: vi.fn(),
}));
vi.mock("@repo/design-system/lib/toast/notify", () => ({
  toast: { error: vi.fn() },
}));

afterEach(() => vi.clearAllMocks());

const messages: Record<"limit" | "missing" | "other", ToastCopy> = {
  limit: { title: "Wait a moment before saving again." },
  missing: { title: "This memory no longer exists." },
  other: {
    description: "Please try again.",
    title: "We could not complete this action.",
  },
};

describe("memory failure", () => {
  it.effect("explains a deleted memory and cannot try the change again", () =>
    Effect.gen(function* () {
      const again = yield* reportMemoryFailure(
        new NinaMemoryRejected({ reason: "missing" }),
        messages
      );

      expect(toast.error).toHaveBeenCalledExactlyOnceWith(
        messages.missing.title,
        { description: messages.missing.description }
      );
      expect(captureException).not.toHaveBeenCalled();
      expect(again).toBe(false);
    })
  );

  it.effect(
    "asks the learner to wait when they saved too often, and lets them try the change again",
    () =>
      Effect.gen(function* () {
        const again = yield* reportMemoryFailure(
          new NinaMemoryRejected({ reason: "limit" }),
          messages
        );

        expect(toast.error).toHaveBeenCalledExactlyOnceWith(
          messages.limit.title,
          { description: messages.limit.description }
        );
        expect(captureException).not.toHaveBeenCalled();
        expect(again).toBe(true);
      })
  );

  it.effect(
    "reports the refusal of an empty memory, which the page never sends",
    () =>
      Effect.gen(function* () {
        const error = new NinaMemoryRejected({ reason: "empty" });
        const again = yield* reportMemoryFailure(error, messages);

        expect(captureException).toHaveBeenCalledExactlyOnceWith(error, {
          source: "components/user/settings/memory",
        });
        expect(toast.error).toHaveBeenCalledExactlyOnceWith(
          messages.other.title,
          { description: messages.other.description }
        );
        expect(again).toBe(true);
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
        expect(toast.error).toHaveBeenCalledExactlyOnceWith(
          messages.other.title,
          { description: messages.other.description }
        );
        expect(again).toBe(true);
      })
  );
});
