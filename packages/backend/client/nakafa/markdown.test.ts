import { beforeEach, describe, expect, it } from "@effect/vitest";
import { readNakafaMarkdown } from "@repo/backend/client/nakafa/markdown";
import {
  makeMaterialContentRef,
  makeMaterialProjection,
} from "@repo/backend/test/content-material";
import { readNakafaContentRefFixture } from "@repo/contents/_lib/agent/fixture";
import type { NakafaAgentContentRef } from "@repo/contents/_lib/agent/schema/ref";
import { Effect, Option } from "effect";
import { vi } from "vitest";

const runtimeMocks = vi.hoisted(() => ({
  readPublishedMarkdown: vi.fn(),
  readQuranMarkdown: vi.fn(),
  resolveNakafaContentRef: vi.fn(),
}));

vi.mock("@repo/backend/client/nakafa/published", () => ({
  readPublishedMarkdown: runtimeMocks.readPublishedMarkdown,
}));
vi.mock("@repo/backend/client/nakafa/quran", () => ({
  readQuranMarkdown: runtimeMocks.readQuranMarkdown,
}));
vi.mock("@repo/backend/client/nakafa/ref", () => ({
  resolveNakafaContentRef: runtimeMocks.resolveNakafaContentRef,
}));

const materialRef = makeMaterialContentRef(makeMaterialProjection("en", 1));
const articleRef = readNakafaContentRefFixture(
  "en",
  "articles/politics/example",
  "articles"
);
const quranRef = readNakafaContentRefFixture("en", "quran/1", "quran");
const materialTopicRef: NakafaAgentContentRef = {
  ...materialRef,
  markdown_url: undefined,
};
const tryoutRef: NakafaAgentContentRef = {
  ...quranRef,
  section: "tryout",
};
const readTarget = () => ({
  siteUrl: "https://example.convex.site",
  token: "runtime-token",
});

beforeEach(() => {
  for (const mock of Object.values(runtimeMocks)) {
    mock.mockReset();
  }
});

describe("readNakafaMarkdown", () => {
  it.effect.each([articleRef, materialRef])(
    "dispatches $section through the signed public reader",
    (ref) =>
      Effect.gen(function* () {
        runtimeMocks.resolveNakafaContentRef.mockReturnValue(
          Effect.succeed(Option.some(ref))
        );
        runtimeMocks.readPublishedMarkdown.mockReturnValue(
          Effect.succeed(Option.none())
        );

        yield* readNakafaMarkdown(
          "https://example.convex.cloud",
          readTarget,
          ref.content_id
        );

        expect(runtimeMocks.readPublishedMarkdown).toHaveBeenCalledWith(
          readTarget,
          ref
        );
      })
  );

  it.effect("dispatches Quran through its signed snapshot reader", () =>
    Effect.gen(function* () {
      runtimeMocks.resolveNakafaContentRef.mockReturnValue(
        Effect.succeed(Option.some(quranRef))
      );
      runtimeMocks.readQuranMarkdown.mockReturnValue(
        Effect.succeed(Option.none())
      );

      yield* readNakafaMarkdown(
        "https://example.convex.cloud",
        readTarget,
        quranRef.content_id
      );

      expect(runtimeMocks.readQuranMarkdown).toHaveBeenCalledWith(
        "https://example.convex.cloud",
        quranRef
      );
    })
  );

  it.effect.each([
    Option.none(),
    Option.some(tryoutRef),
    Option.some(materialTopicRef),
  ])(
    "returns no markdown when the current identity has no readable body",
    (ref) =>
      Effect.gen(function* () {
        runtimeMocks.resolveNakafaContentRef.mockReturnValue(
          Effect.succeed(ref)
        );

        expect(
          yield* readNakafaMarkdown(
            "https://example.convex.cloud",
            readTarget,
            "unsupported"
          )
        ).toEqual(Option.none());
        expect(runtimeMocks.readPublishedMarkdown).not.toHaveBeenCalled();
        expect(runtimeMocks.readQuranMarkdown).not.toHaveBeenCalled();
      })
  );
});
