// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import type { CatalogQuery } from "@/components/tryout/catalog/table/query";
import {
  readTryoutCountryHandler,
  readTryoutExamHandler,
  readTryoutTrackHandler,
  readTryoutTrackListHandler,
} from "@/components/tryout/route/catalog.server";

const catalog = vi.hoisted(() => ({
  getAksaraTreeUrl: vi.fn(),
  getAppSocialArtwork: vi.fn(),
  getOgUrl: vi.fn(),
  readRequestToken: vi.fn(),
  readServerTranslator: vi.fn(),
  readTryoutCountryPage: vi.fn(),
  readTryoutExamPage: vi.fn(),
  readTryoutHubPage: vi.fn(),
  readTryoutMetadata: vi.fn(),
  readTryoutSetList: vi.fn(),
  readTryoutTrackPage: vi.fn(),
  setResponseHeader: vi.fn(),
}));

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => new Request("https://nakafa.com/en/try-out"),
  setResponseHeader: catalog.setResponseHeader,
}));
vi.mock("@/components/tryout/catalog/source.server", () => ({
  readTryoutCountryPage: catalog.readTryoutCountryPage,
  readTryoutExamPage: catalog.readTryoutExamPage,
  readTryoutHubPage: catalog.readTryoutHubPage,
  readTryoutMetadata: catalog.readTryoutMetadata,
  readTryoutSetList: catalog.readTryoutSetList,
  readTryoutTrackPage: catalog.readTryoutTrackPage,
}));
vi.mock("@/components/tryout/route/token.server", () => ({
  readRequestToken: catalog.readRequestToken,
}));
vi.mock("@/lib/content/repository", () => ({
  getAksaraTreeUrl: catalog.getAksaraTreeUrl,
}));
vi.mock("@/lib/og/app", () => ({
  getAppSocialArtwork: catalog.getAppSocialArtwork,
}));
vi.mock("@/lib/seo/social", () => ({ getOgUrl: catalog.getOgUrl }));
vi.mock("@repo/internationalization/src/translator", () => ({
  readServerTranslator: catalog.readServerTranslator,
}));

const COUNTRY = "try-out/id";
const EXAM = "try-out/id/snbt";
const TRACK = "try-out/id/snbt/2027";

const countryPage = { country: { countryKey: "id" }, exams: [] };
const hub = { countries: [], sourceRevision: undefined };
const search = {
  direction: "asc",
  sort: "title",
  status: "all",
} satisfies CatalogQuery;
const track = { countryKey: "id", examKey: "snbt", trackKey: "2027" };

beforeEach(() => {
  vi.clearAllMocks();
  catalog.readRequestToken.mockReturnValue(Effect.succeedSome("token-1"));
  catalog.readServerTranslator.mockImplementation(() =>
    Promise.resolve((key: string) => key)
  );
  catalog.readTryoutMetadata.mockReturnValue(
    Effect.succeed({ route: undefined })
  );
  catalog.readTryoutHubPage.mockReturnValue(Effect.succeed(hub));
  catalog.readTryoutCountryPage.mockReturnValue(
    Effect.succeedSome(countryPage)
  );
  catalog.readTryoutExamPage.mockReturnValue(Effect.void);
  catalog.readTryoutTrackPage.mockReturnValue(Effect.void);
});

describe("try-out catalog server functions", () => {
  it("answers one country through its server handler", async () => {
    catalog.readTryoutCountryPage.mockReturnValueOnce(Effect.succeedNone);

    await expect(
      readTryoutCountryHandler({ data: { country: "id", locale: "en" } })
    ).resolves.toEqual({ kind: "notFound" });
    expect(catalog.readTryoutCountryPage).toHaveBeenCalledExactlyOnceWith(
      "en",
      COUNTRY
    );
  });

  it("answers one exam through its server handler", async () => {
    await expect(
      readTryoutExamHandler({
        data: { country: "id", exam: "snbt", locale: "en" },
      })
    ).resolves.toEqual({ kind: "notFound" });
    expect(catalog.readTryoutExamPage).toHaveBeenCalledExactlyOnceWith(
      "en",
      EXAM
    );
  });

  it("answers one track through its server handler", async () => {
    await expect(
      readTryoutTrackHandler({
        data: { country: "id", exam: "snbt", locale: "en", track: "2027" },
      })
    ).resolves.toEqual({ kind: "notFound" });
    expect(catalog.readTryoutTrackPage).toHaveBeenCalledExactlyOnceWith(
      "en",
      TRACK
    );
  });

  it("answers the learner's set list of one track with its query", async () => {
    catalog.readTryoutSetList.mockReturnValue(
      Effect.succeed({ page: [], isDone: true })
    );

    const answer = await readTryoutTrackListHandler({
      data: { locale: "en", search, track },
    });

    expect(answer.result).toEqual({ page: [], isDone: true });
    expect(answer.args).toMatchObject({
      countryKey: "id",
      examKey: "snbt",
      filter: "all",
      locale: "en",
      sort: { direction: "asc", field: "title" },
      trackKey: "2027",
    });
    expect(catalog.readTryoutSetList).toHaveBeenCalledExactlyOnceWith(
      Option.some("token-1"),
      answer.args
    );
  });
});
