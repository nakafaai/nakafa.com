import { api } from "@repo/backend/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readTryoutContentAccess } from "@/components/tryout/content/access";

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

describe("tryout server content access", () => {
  beforeEach(() => {
    vi.mocked(fetchQuery).mockReset();
  });

  it("passes the request token to the content authorization query", async () => {
    vi.mocked(fetchQuery).mockResolvedValue({
      answers: false,
      questions: true,
    });

    await expect(
      Effect.runPromise(readTryoutContentAccess("request-token", args))
    ).resolves.toEqual({ answers: false, questions: true });
    expect(fetchQuery).toHaveBeenCalledWith(
      api.tryouts.queries.access.getSectionContent,
      args,
      { token: "request-token" }
    );
  });

  it("preserves a typed failure when the authorization query fails", async () => {
    vi.mocked(fetchQuery).mockRejectedValue(new Error("offline"));

    await expect(
      Effect.runPromise(
        readTryoutContentAccess("request-token", args).pipe(Effect.flip)
      )
    ).resolves.toEqual(
      expect.objectContaining({
        _tag: "TryoutContentAccessError",
        message: "Unable to authorize try-out content.",
      })
    );
  });
});
