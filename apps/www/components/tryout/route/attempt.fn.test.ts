// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import {
  readTryoutSectionHandler,
  readTryoutSetHandler,
} from "@/components/tryout/route/attempt.fn";

const readers = vi.hoisted(() => ({
  readTryoutSectionRoute: vi.fn(),
  readTryoutSetRoute: vi.fn(),
}));

vi.mock("@/components/tryout/route/attempt.server", () => ({
  readTryoutSetRoute: readers.readTryoutSetRoute,
}));
vi.mock("@/components/tryout/route/section.server", () => ({
  readTryoutSectionRoute: readers.readTryoutSectionRoute,
}));
vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => new Request("https://nakafa.test/en/try-out"),
}));

const address = {
  country: "id",
  exam: "snbt",
  locale: "en",
  search: { attemptId: "attempt-1", view: "single" },
  track: "2027",
} as const;

describe("try-out attempt server functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("answers one set page for its learner with the attempt search", async () => {
    readers.readTryoutSetRoute.mockReturnValueOnce(
      Effect.succeed({ kind: "catalog" })
    );

    await expect(
      readTryoutSetHandler({ data: { ...address, set: "set-1" } })
    ).resolves.toEqual({ kind: "catalog" });
    expect(readers.readTryoutSetRoute).toHaveBeenCalledExactlyOnceWith({
      ...address,
      set: "set-1",
    });
  });

  it("answers one section page for its learner with the attempt search", async () => {
    readers.readTryoutSectionRoute.mockReturnValueOnce(
      Effect.succeed({ kind: "attempt" })
    );

    await expect(
      readTryoutSectionHandler({
        data: { ...address, section: "section-1", set: "set-1" },
      })
    ).resolves.toEqual({ kind: "attempt" });
    expect(readers.readTryoutSectionRoute).toHaveBeenCalledExactlyOnceWith({
      ...address,
      section: "section-1",
      set: "set-1",
    });
  });
});
