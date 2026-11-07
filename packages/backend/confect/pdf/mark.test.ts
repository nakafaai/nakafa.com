import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { NAKAFA_MARK_SVG } from "@repo/backend/confect/pdf/mark";
import { Effect, FileSystem, Path } from "effect";

describe("pdf/mark", () => {
  it.effect("carries the mark the app serves, unchanged", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const logo = yield* path.fromFileUrl(
        new URL("../../../../apps/www/public/logo.svg", import.meta.url)
      );
      expect(yield* fs.readFileString(logo)).toBe(NAKAFA_MARK_SVG);
    }).pipe(Effect.provide(NodeServices.layer))
  );
});
