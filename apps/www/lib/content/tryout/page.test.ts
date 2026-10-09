// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { createTestPublication } from "@repo/backend/test/content/publication";
import { makeTryoutRuntimeSource } from "@repo/backend/test/tryout/serving";
import {
  makeTryoutStartHierarchy,
  makeTryoutStartPlacement,
} from "@repo/backend/test/tryout/source";
import { Array as Arr, Effect, Layer } from "effect";
import {
  readPublishedTryoutExamPage,
  readPublishedTryoutSectionPage,
} from "@/lib/content/tryout/page";

const runtimeQueryMock = vi.hoisted(() => vi.fn());
vi.mock("@confect/js", async (importOriginal) => {
  const { HttpClient } = await importOriginal<typeof import("@confect/js")>();
  return {
    HttpClient: {
      ...HttpClient,
      layer: (...args: Parameters<typeof HttpClient.layer>) =>
        Layer.effect(
          HttpClient.HttpClient,
          Effect.gen(function* () {
            const client = yield* HttpClient.HttpClient;
            return {
              ...client,
              query: runtimeQueryMock,
            };
          })
        ).pipe(Layer.provide(HttpClient.layer(...args))),
    },
  };
});

const SUBJECT_SECTION_PATH =
  "try-out/indonesia/tka/matematika-wajib/set-1/matematika-wajib";

describe("published try-out pages for routing", () => {
  beforeEach(() => {
    runtimeQueryMock.mockReset();
  });

  it.effect("reads a live exam with its signed tracks", () =>
    Effect.gen(function* () {
      const fixture = yield* makeTryoutRuntimeSource();
      const context = yield* createTestPublication(fixture.source);
      runtimeQueryMock.mockImplementation(context.query);

      expect(
        yield* readPublishedTryoutExamPage({
          appLocale: "en",
          publicPath: "try-out/indonesia/tka",
        })
      ).toMatchObject({
        exam: { examKey: "tka" },
        tracks: [{ trackKey: "matematika-wajib" }],
      });
    })
  );

  it.effect("returns no exam page for an absent exam", () =>
    Effect.gen(function* () {
      const fixture = yield* makeTryoutRuntimeSource();
      const context = yield* createTestPublication(fixture.source);
      runtimeQueryMock.mockImplementation(context.query);

      expect(
        yield* readPublishedTryoutExamPage({
          appLocale: "en",
          publicPath: "try-out/indonesia/snbt",
        })
      ).toBeNull();
    })
  );

  it.effect("reads a visible section as a live page", () =>
    Effect.gen(function* () {
      const fixture = yield* makeTryoutRuntimeSource();
      const context = yield* createTestPublication(fixture.source);
      runtimeQueryMock.mockImplementation(context.query);

      expect(
        yield* readPublishedTryoutSectionPage({
          appLocale: "en",
          publicPath: SUBJECT_SECTION_PATH,
        })
      ).toMatchObject({
        section: { sectionKey: "matematika-wajib" },
      });
    })
  );

  it.effect("returns no section page for an internal entry", () =>
    Effect.gen(function* () {
      const catalog = Arr.flatMap(ACTIVE_APP_LOCALE_CODES, (appLocale) =>
        makeTryoutStartHierarchy(appLocale, "internal-entry")
      );
      const placements = Arr.map(
        ACTIVE_APP_LOCALE_CODES,
        makeTryoutStartPlacement
      );
      const fixture = yield* makeTryoutRuntimeSource(undefined, {
        catalog,
        placements,
      });
      const context = yield* createTestPublication(fixture.source);
      runtimeQueryMock.mockImplementation(context.query);

      expect(
        yield* readPublishedTryoutSectionPage({
          appLocale: "en",
          publicPath: SUBJECT_SECTION_PATH,
        })
      ).toBeNull();
    })
  );
});
