// @vitest-environment node

import { afterEach, describe, expect, it } from "@effect/vitest";
import { ContentKeySchema } from "@nakafa/aksara-contracts/ids";
import { Array as Arr, Effect, Order, Record as Rec } from "effect";

vi.mock("use-intl", () => ({
  /** Keeps renderer selection independent from navigation runtime behavior. */
  useTranslations: () => () => "",
}));

const contentKey = ContentKeySchema.make("test:renderer-components");

afterEach(() => {
  vi.doUnmock("@repo/design-system/lib/markdown/semantic");
  vi.doUnmock("@/lib/content/renderer/registry/politics");
  vi.resetModules();
});

describe("renderer components", () => {
  it.effect(
    "resolves the physics MathVisual artifact",
    () =>
      Effect.gen(function* () {
        const { resolveRendererComponents } = yield* Effect.promise(
          () => import("@/lib/content/renderer/components")
        );
        const components = yield* resolveRendererComponents({
          contentKey,
          rendererDomain: "physics",
          requiredComponents: ["MathVisual"],
        });
        expect(components.MathVisual).toBeDefined();
      }),
    // This integration seam loads the real physics renderer module graph.
    15_000
  );

  it.effect(
    "resolves semantic HTML plus exactly the signed custom requirements",
    () =>
      Effect.gen(function* () {
        const { semanticMdxComponents } = yield* Effect.promise(
          () => import("@repo/design-system/lib/markdown/semantic")
        );
        const { resolveRendererComponents } = yield* Effect.promise(
          () => import("@/lib/content/renderer/components")
        );
        const components = yield* resolveRendererComponents({
          contentKey,
          rendererDomain: "snbt-plain",
          requiredComponents: ["p", "InlineMath"],
        });

        expect(components).toMatchObject(semanticMdxComponents);
        expect(
          Arr.sort(Rec.keys<string, unknown>(components), Order.String)
        ).toEqual(
          Arr.sort(
            [...Rec.keys(semanticMdxComponents), "InlineMath"],
            Order.String
          )
        );
        expect(components).not.toHaveProperty("BlockMath");
        expect(components).not.toHaveProperty("Mermaid");
      })
  );

  it.effect(
    "fails with the signed identity when an implementation is missing",
    () =>
      Effect.gen(function* () {
        const { resolveRendererComponents } = yield* Effect.promise(
          () => import("@/lib/content/renderer/components")
        );
        const failure = yield* resolveRendererComponents({
          contentKey,
          rendererDomain: "site",
          requiredComponents: ["MissingRenderer"],
        }).pipe(Effect.flip);

        expect(failure).toMatchObject({
          _tag: "RendererImplementationMissing",
          componentName: "MissingRenderer",
          contentKey,
          rendererDomain: "site",
        });
      })
  );

  it.effect(
    "fails when semantic ownership and implementation coverage drift",
    () =>
      Effect.gen(function* () {
        yield* Effect.sync(() =>
          vi.doMock("@repo/design-system/lib/markdown/semantic", () => ({
            semanticMdxComponents: {},
          }))
        );
        const { resolveRendererComponents } = yield* Effect.promise(
          () => import("@/lib/content/renderer/components")
        );
        const failure = yield* resolveRendererComponents({
          contentKey,
          rendererDomain: "site",
          requiredComponents: ["p"],
        }).pipe(Effect.flip);

        expect(failure).toMatchObject({
          _tag: "RendererImplementationMissing",
          componentName: "p",
          contentKey,
          rendererDomain: "site",
        });
      })
  );

  it.effect("rejects a name that a visual registry also claims", () =>
    Effect.gen(function* () {
      yield* Effect.sync(() =>
        vi.doMock("@/lib/content/renderer/registry/politics", () => ({
          politicsRenderers: [{ component: () => null, name: "InlineMath" }],
        }))
      );
      const { resolveRendererComponents } = yield* Effect.promise(
        () => import("@/lib/content/renderer/components")
      );
      const failure = yield* resolveRendererComponents({
        contentKey,
        rendererDomain: "site",
        requiredComponents: ["InlineMath"],
      }).pipe(Effect.flip);

      expect(failure).toMatchObject({
        _tag: "RendererComponentCollision",
        componentName: "InlineMath",
        contentKey,
        rendererDomain: "site",
      });
    })
  );

  it.effect("rejects duplicate implementations of one name", () =>
    Effect.gen(function* () {
      yield* Effect.sync(() =>
        vi.doMock("@/lib/content/renderer/registry/politics", () => ({
          politicsRenderers: [
            { component: () => null, name: "SiteWidget" },
            { component: () => null, name: "SiteWidget" },
          ],
        }))
      );
      const { resolveRendererComponents } = yield* Effect.promise(
        () => import("@/lib/content/renderer/components")
      );
      const failure = yield* resolveRendererComponents({
        contentKey,
        rendererDomain: "site",
        requiredComponents: ["SiteWidget"],
      }).pipe(Effect.flip);

      expect(failure).toMatchObject({
        _tag: "RendererComponentCollision",
        componentName: "SiteWidget",
        contentKey,
        rendererDomain: "site",
      });
    })
  );

  it.effect("resolves only the signed renderers", () =>
    Effect.gen(function* () {
      const { semanticMdxComponents } = yield* Effect.promise(
        () => import("@repo/design-system/lib/markdown/semantic")
      );
      const { resolveRendererComponents } = yield* Effect.promise(
        () => import("@/lib/content/renderer/components")
      );
      const components = yield* resolveRendererComponents({
        contentKey,
        rendererDomain: "mathematics",
        requiredComponents: ["MathVisual"],
      });

      expect(
        Arr.sort(Rec.keys<string, unknown>(components), Order.String)
      ).toEqual(
        Arr.sort(
          [...Rec.keys(semanticMdxComponents), "MathVisual"],
          Order.String
        )
      );
      expect(components).not.toHaveProperty("FunctionChart");
    })
  );

  it.effect("resolves any visual for a lesson of any domain", () =>
    Effect.gen(function* () {
      const { resolveRendererComponents } = yield* Effect.promise(
        () => import("@/lib/content/renderer/components")
      );
      const components = yield* resolveRendererComponents({
        contentKey,
        rendererDomain: "site",
        requiredComponents: ["MathVisual", "AtomShellLab", "VirusRoleLab"],
      });

      expect(components).toHaveProperty("MathVisual");
      expect(components).toHaveProperty("AtomShellLab");
      expect(components).toHaveProperty("VirusRoleLab");
    })
  );
});
