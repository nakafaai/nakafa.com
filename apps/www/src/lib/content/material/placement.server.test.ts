// @vitest-environment node

import { afterEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { readPlacement } from "@/lib/content/material/placement.server";
import { previewProjection } from "@/test/content-preview";

const mocks = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@/lib/content/material/context", () => ({
  readPublishedMaterialContext: mocks.read,
}));

/** One lesson as its page holds it, with the hint of the reader's address. */
const lesson = {
  contentKey: previewProjection.contentKey,
  ctx: "merdeka~class-11-mathematics-function-composition-inverse-function",
  locale: "en",
  materialKey: previewProjection.materialKey,
  parentPath: previewProjection.parentPath,
  publicPath: previewProjection.publicPath,
};

describe("lesson curriculum placement", () => {
  afterEach(() => mocks.read.mockReset());

  it.effect(
    "verifies the program node that the hint names and answers what the links read",
    () =>
      Effect.gen(function* () {
        const context = {
          nodeKey: "class-11-mathematics-function-composition-inverse-function",
          programKey: "merdeka",
        };
        mocks.read.mockReturnValue(
          Effect.succeed({
            context,
            group: { title: "Function Composition and Inverse Function" },
            hash: "function-composition-and-inverse-function",
            label: "Function Composition and Inverse Function",
            mapping: { programKey: "merdeka" },
            parent: {
              level: "subject",
              publicPath: "curriculum/merdeka/class-11/mathematics",
            },
            resolvedCanonicalPath: lesson.publicPath,
          })
        );

        expect(yield* readPlacement(lesson)).toStrictEqual({
          context,
          hash: "function-composition-and-inverse-function",
          label: "Function Composition and Inverse Function",
          parent: { publicPath: "curriculum/merdeka/class-11/mathematics" },
          resolvedCanonicalPath: lesson.publicPath,
        });
        expect(mocks.read).toHaveBeenCalledExactlyOnceWith(
          "en",
          lesson,
          context
        );
      })
  );

  it.effect("reads no placement when the release verifies none", () =>
    Effect.gen(function* () {
      mocks.read.mockReturnValue(Effect.succeed(null));
      expect(yield* readPlacement(lesson)).toBeNull();
    })
  );

  for (const ctx of ["", "merdeka", "merdeka~node~extra", "~node"]) {
    it.effect(`reads no placement and no release for the hint "${ctx}"`, () =>
      Effect.gen(function* () {
        expect(yield* readPlacement({ ...lesson, ctx })).toBeNull();
        expect(mocks.read).not.toHaveBeenCalled();
      })
    );
  }
});
