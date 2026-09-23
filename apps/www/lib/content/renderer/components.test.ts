// @vitest-environment node

import { afterEach, describe, expect, it } from "@effect/vitest";
import { ContentKeySchema } from "@nakafa/aksara-contracts/ids";
import { Effect } from "effect";

vi.mock("@repo/internationalization/src/navigation", () => ({
  getPathname: vi.fn(),
  Link: vi.fn(),
  redirect: vi.fn(),
  usePathname: vi.fn(),
  useRouter: vi.fn(),
}));
vi.mock("next-intl", () => ({
  /** Keeps renderer selection independent from navigation runtime behavior. */
  useTranslations: () => () => "",
}));

const contentKey = ContentKeySchema.make("test:renderer-components");

afterEach(() => {
  vi.doUnmock("@repo/design-system/lib/markdown/semantic");
  vi.doUnmock("@/lib/content/renderer/domain/site");
  vi.resetModules();
});

describe("renderer components", () => {
  it.effect(
    "resolves the physics LineEquation artifact",
    () =>
      Effect.gen(function* () {
        const { resolveRendererComponents } = yield* Effect.promise(
          () => import("@/lib/content/renderer/components")
        );
        const components = yield* resolveRendererComponents({
          contentKey,
          rendererDomain: "physics",
          requiredComponents: ["LineEquation"],
        });
        expect(components.LineEquation).toBeDefined();
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
        expect(Object.keys(components).sort()).toEqual(
          [...Object.keys(semanticMdxComponents), "InlineMath"].sort()
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

  it.effect("rejects a base and selected-domain ownership collision", () =>
    Effect.gen(function* () {
      yield* Effect.sync(() =>
        vi.doMock("@/lib/content/renderer/domain/site", () => ({
          domainRenderers: [{ component: () => null, name: "InlineMath" }],
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

  it.effect(
    "rejects duplicate implementations inside the selected domain",
    () =>
      Effect.gen(function* () {
        yield* Effect.sync(() =>
          vi.doMock("@/lib/content/renderer/domain/site", () => ({
            domainRenderers: [
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

  it.effect("resolves only the signed renderer from its selected domain", () =>
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
        requiredComponents: ["Triangle"],
      });

      expect(Object.keys(components).sort()).toEqual(
        [...Object.keys(semanticMdxComponents), "Triangle"].sort()
      );
      expect(components).not.toHaveProperty("UnitCircle");
    })
  );

  it.effect("rejects a renderer registered only in another domain", () =>
    Effect.gen(function* () {
      const { resolveRendererComponents } = yield* Effect.promise(
        () => import("@/lib/content/renderer/components")
      );
      const failure = yield* resolveRendererComponents({
        contentKey,
        rendererDomain: "site",
        requiredComponents: ["Triangle"],
      }).pipe(Effect.flip);

      expect(failure).toMatchObject({
        _tag: "RendererImplementationMissing",
        componentName: "Triangle",
        contentKey,
        rendererDomain: "site",
      });
    })
  );
});
