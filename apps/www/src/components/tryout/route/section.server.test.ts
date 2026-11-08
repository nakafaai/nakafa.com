// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { readTryoutSectionRoute } from "@/components/tryout/route/section.server";

const mocks = vi.hoisted(() => ({
  readTryoutRouteHead: vi.fn(),
  readTryoutSectionPage: vi.fn(),
}));

vi.mock("@repo/internationalization/src/translator", () => ({
  readServerTranslator: () => Promise.resolve((key: string) => key),
}));
vi.mock("@/components/tryout/catalog/source.server", () => ({
  readTryoutSectionPage: mocks.readTryoutSectionPage,
}));
vi.mock("@/components/tryout/route/metadata.server", () => ({
  readTryoutRouteHead: mocks.readTryoutRouteHead,
}));

const SET = "try-out/id/snbt/2027/set-1";
const SECTION = `${SET}/section-1`;
const head = {
  canonicalPath: `/en/${SECTION}`,
  description: "Section 1",
  image: "og-url",
  indexable: true,
  title: "Section 1",
};
const address = {
  country: "id",
  exam: "snbt",
  locale: "en",
  section: "section-1",
  set: "set-1",
  track: "2027",
} as const;
const catalogSection = {
  exam: { title: "SNBT" },
  section: { publicPath: SECTION, sectionKey: "section-1", title: "Section 1" },
  set: { countryKey: "id", examKey: "snbt", publicPath: SET, title: "Set 1" },
  track: { title: "Year 2027" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.readTryoutSectionPage.mockReturnValue(Effect.succeed(catalogSection));
  mocks.readTryoutRouteHead.mockReturnValue(Effect.succeedSome(head));
});

describe("readTryoutSectionRoute", () => {
  it.effect(
    "answers the section's catalog view with the set it returns to",
    () =>
      Effect.gen(function* () {
        expect(yield* readTryoutSectionRoute(address)).toMatchObject({
          head: {
            ...head,
            description: "section-metadata-description",
            indexable: false,
            title: ["Section 1", "Set 1", "SNBT Year 2027"],
          },
          kind: "catalog",
          page: catalogSection,
          route: address,
          sectionPath: SECTION,
          setPath: SET,
        });
        expect(mocks.readTryoutSectionPage).toHaveBeenCalledExactlyOnceWith(
          "en",
          SECTION
        );
      })
  );

  it.effect(
    "shares the reviewed artwork of an SNBT section as its social image",
    () =>
      Effect.gen(function* () {
        mocks.readTryoutSectionPage.mockReturnValueOnce(
          Effect.succeed({
            ...catalogSection,
            section: {
              ...catalogSection.section,
              sectionKey: "general-reasoning",
            },
            set: { ...catalogSection.set, countryKey: "indonesia" },
          })
        );

        expect(yield* readTryoutSectionRoute(address)).toMatchObject({
          head: {
            image: "/open-graph/tryout/indonesia/snbt/en-general-reasoning.png",
          },
        });
      })
  );

  it.effect("keeps the description a section was published with", () =>
    Effect.gen(function* () {
      mocks.readTryoutSectionPage.mockReturnValueOnce(
        Effect.succeed({
          ...catalogSection,
          section: {
            ...catalogSection.section,
            description: "Written for this section.",
          },
        })
      );

      expect(yield* readTryoutSectionRoute(address)).toMatchObject({
        head: { description: "Written for this section." },
      });
    })
  );

  it.effect(
    "answers not found when the catalog has no section page or no head",
    () =>
      Effect.gen(function* () {
        mocks.readTryoutSectionPage.mockReturnValueOnce(Effect.void);
        expect(yield* readTryoutSectionRoute(address)).toEqual({
          kind: "notFound",
        });

        mocks.readTryoutRouteHead.mockReturnValueOnce(Effect.succeedNone);
        expect(yield* readTryoutSectionRoute(address)).toEqual({
          kind: "notFound",
        });
      })
  );
});
