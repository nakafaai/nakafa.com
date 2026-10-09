// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Effect, Path } from "effect";
import { indexingFiles } from "@/scripts/indexing/paths";

describe("indexingFiles", () => {
  it.effect(
    "places the key, the state folder, and the history file under the scripts folder, where git ignores them",
    () =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        const files = yield* indexingFiles;
        // This test file sits beside paths.ts, so two folders up is the scripts folder.
        const thisFile = yield* Effect.orDie(
          path.fromFileUrl(new URL(import.meta.url))
        );
        const scriptsFolder = path.dirname(path.dirname(thisFile));

        expect(path.relative(scriptsFolder, files.googleKey)).toBe(
          "google-key.json"
        );
        expect(path.relative(scriptsFolder, files.stateFolder)).toBe("state");
        expect(path.relative(files.stateFolder, files.submissionHistory)).toBe(
          "submission-history.json"
        );
      }).pipe(Effect.provide(Path.layer))
  );
});
