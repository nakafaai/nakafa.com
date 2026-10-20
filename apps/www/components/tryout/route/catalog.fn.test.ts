// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import {
  readTryoutCountryHandler,
  readTryoutExamHandler,
  readTryoutHubHandler,
  readTryoutTrackHandler,
  readTryoutTrackListHandler,
} from "@/components/tryout/route/catalog.fn";

const readers = vi.hoisted(() => ({
  readTryoutCountryRoute: vi.fn(),
  readTryoutExamRoute: vi.fn(),
  readTryoutHubRoute: vi.fn(),
  readTryoutTrackRoute: vi.fn(),
  readTryoutTrackSetList: vi.fn(),
}));

vi.mock("@/components/tryout/route/catalog.server", () => readers);
vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => new Request("https://nakafa.test/en/try-out"),
}));

const track = { countryKey: "id", examKey: "snbt", trackKey: "2027" };

describe("try-out catalog server functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("answers the hub of the locale it was asked for", async () => {
    readers.readTryoutHubRoute.mockReturnValueOnce(
      Effect.succeed({ kind: "hub" })
    );

    await expect(
      readTryoutHubHandler({ data: { locale: "en" } })
    ).resolves.toEqual({ kind: "hub" });
    expect(readers.readTryoutHubRoute).toHaveBeenCalledExactlyOnceWith("en");
  });

  it("answers one country with its address segments", async () => {
    readers.readTryoutCountryRoute.mockReturnValueOnce(
      Effect.succeed({ kind: "notFound" })
    );

    await expect(
      readTryoutCountryHandler({ data: { country: "id", locale: "id" } })
    ).resolves.toEqual({ kind: "notFound" });
    expect(readers.readTryoutCountryRoute).toHaveBeenCalledExactlyOnceWith({
      country: "id",
      locale: "id",
    });
  });

  it("answers one exam with its address segments", async () => {
    readers.readTryoutExamRoute.mockReturnValueOnce(
      Effect.succeed({ kind: "found" })
    );

    await expect(
      readTryoutExamHandler({
        data: { country: "id", exam: "snbt", locale: "en" },
      })
    ).resolves.toEqual({ kind: "found" });
    expect(readers.readTryoutExamRoute).toHaveBeenCalledExactlyOnceWith({
      country: "id",
      exam: "snbt",
      locale: "en",
    });
  });

  it("answers one track with its address segments", async () => {
    readers.readTryoutTrackRoute.mockReturnValueOnce(
      Effect.succeed({ kind: "found" })
    );

    await expect(
      readTryoutTrackHandler({
        data: { country: "id", exam: "snbt", locale: "en", track: "2027" },
      })
    ).resolves.toEqual({ kind: "found" });
    expect(readers.readTryoutTrackRoute).toHaveBeenCalledExactlyOnceWith({
      country: "id",
      exam: "snbt",
      locale: "en",
      track: "2027",
    });
  });

  it("answers the learner's set list of one track with its query", async () => {
    const search = { sort: "title" };
    readers.readTryoutTrackSetList.mockReturnValueOnce(
      Effect.succeed({ args: {}, result: {} })
    );

    await expect(
      readTryoutTrackListHandler({
        data: { locale: "en", search, track },
      })
    ).resolves.toEqual({ args: {}, result: {} });
    expect(readers.readTryoutTrackSetList).toHaveBeenCalledExactlyOnceWith({
      locale: "en",
      search,
      track,
    });
  });
});
