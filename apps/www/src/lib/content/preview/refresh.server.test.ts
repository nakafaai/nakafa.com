// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import { readPreviewRefresh } from "@/lib/content/preview/refresh.server";

let previewConfigured = false;

vi.mock("@/lib/content/preview/config", () => ({
  hasPreviewConfig: () => previewConfigured,
}));

vi.mock("@/lib/content/preview/manifest", () => ({
  readPreviewManifest: () => Effect.succeed({ revision: 7, status: "ready" }),
}));

describe("readPreviewRefresh", () => {
  it.effect(
    "answers nothing without a local preview, so no listener renders",
    () =>
      Effect.gen(function* () {
        previewConfigured = false;

        expect(Option.isNone(yield* readPreviewRefresh())).toBe(true);
      })
  );

  it.effect("answers the revision and status of the local preview", () =>
    Effect.gen(function* () {
      previewConfigured = true;

      expect(Option.getOrThrow(yield* readPreviewRefresh())).toStrictEqual({
        revision: 7,
        status: "ready",
      });
    })
  );
});
