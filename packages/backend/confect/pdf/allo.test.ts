import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { ALLO_FACES } from "@repo/backend/confect/pdf/allo";
import { Array as Arr, Effect, FileSystem, Order, Path } from "effect";
import { Base64 } from "effect/encoding";

describe("pdf/allo", () => {
  it.effect("carries every face the design system serves, unchanged", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const folder = yield* path.fromFileUrl(
        new URL("../../../design-system/fonts/allo/", import.meta.url)
      );
      const served = Arr.sort(
        Arr.filter(yield* fs.readDirectory(folder), (file) =>
          file.endsWith(".woff2")
        ),
        Order.String
      );
      const files = Arr.map(ALLO_FACES, (face) => `${face.subset}.woff2`);
      expect(Arr.sort(files, Order.String)).toEqual(served);
      for (const face of ALLO_FACES) {
        const file = yield* fs.readFile(
          path.join(folder, `${face.subset}.woff2`)
        );
        expect(yield* Effect.fromResult(Base64.decode(face.data))).toEqual(
          new Uint8Array(file)
        );
      }
    }).pipe(Effect.provide(NodeServices.layer))
  );
});
