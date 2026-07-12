import { api } from "@repo/backend/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { canReadTryoutAnswers } from "@/components/tryout/content/review";

vi.mock("server-only", () => ({}));
vi.mock("convex/nextjs", () => ({ fetchQuery: vi.fn() }));

const args = {
  countryKey: "indonesia",
  examKey: "snbt",
  locale: "id" as const,
  sectionKey: "penalaran-matematika",
  setKey: "set-1",
  trackKey: "2027",
};

describe("tryout review server access", () => {
  beforeEach(() => {
    vi.mocked(fetchQuery).mockReset();
  });

  it("passes the request token to the review authorization query", async () => {
    vi.mocked(fetchQuery).mockResolvedValue(true);

    await expect(
      Effect.runPromise(canReadTryoutAnswers("request-token", args))
    ).resolves.toBe(true);
    expect(fetchQuery).toHaveBeenCalledWith(
      api.tryouts.queries.review.canReadSection,
      args,
      { token: "request-token" }
    );
  });

  it("preserves a typed failure when the authorization query fails", async () => {
    vi.mocked(fetchQuery).mockRejectedValue(new Error("offline"));

    await expect(
      Effect.runPromise(
        canReadTryoutAnswers("request-token", args).pipe(Effect.flip)
      )
    ).resolves.toEqual(
      expect.objectContaining({
        _tag: "TryoutReviewAccessError",
        message: "Unable to authorize try-out answer review.",
      })
    );
  });
});
