// @vitest-environment node

import { afterEach, describe, expect, it } from "@effect/vitest";
import { ContentKeySchema } from "@nakafa/aksara-contracts/ids";
import { semanticMdxComponents } from "@repo/design-system/lib/markdown/semantic";
import { Data, Effect } from "effect";

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

class RendererFixtureUnavailable extends Data.TaggedError(
  "RendererFixtureUnavailable"
)<{
  readonly resource: "component" | "domain";
}> {}

afterEach(() => {
  vi.doUnmock("@repo/design-system/lib/markdown/semantic");
  vi.doUnmock("@/lib/content/renderer/domain/site");
  vi.resetModules();
});

describe("renderer components", () => {
  it.effect(
    "loads semantic HTML plus exactly the signed custom requirements",
    () =>
      Effect.gen(function* () {
        const { resolveRendererComponents } = yield* Effect.promise(
          () => import("@/lib/content/renderer/components")
        );
        const components = yield* resolveRendererComponents({
          contentKey,
          rendererDomain: "snbt-plain",
          requiredComponents: [{ name: "InlineMath", version: 1 }],
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
          requiredComponents: [{ name: "MissingRenderer", version: 1 }],
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
          requiredComponents: [{ name: "p", version: 1 }],
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
          domainComponentLoaders: [
            { load: () => Promise.resolve(() => null), name: "InlineMath" },
          ],
        }))
      );
      const { resolveRendererComponents } = yield* Effect.promise(
        () => import("@/lib/content/renderer/components")
      );
      const failure = yield* resolveRendererComponents({
        contentKey,
        rendererDomain: "site",
        requiredComponents: [{ name: "InlineMath", version: 1 }],
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
            domainComponentLoaders: [
              { load: () => Promise.resolve(() => null), name: "SiteWidget" },
              { load: () => Promise.resolve(() => null), name: "SiteWidget" },
            ],
          }))
        );
        const { resolveRendererComponents } = yield* Effect.promise(
          () => import("@/lib/content/renderer/components")
        );
        const failure = yield* resolveRendererComponents({
          contentKey,
          rendererDomain: "site",
          requiredComponents: [{ name: "SiteWidget", version: 1 }],
        }).pipe(Effect.flip);

        expect(failure).toMatchObject({
          _tag: "RendererComponentCollision",
          componentName: "SiteWidget",
          contentKey,
          rendererDomain: "site",
        });
      })
  );

  it.effect("preserves domain import failures in the typed error channel", () =>
    Effect.gen(function* () {
      yield* Effect.sync(() =>
        vi.doMock("@/lib/content/renderer/domain/site", () => {
          throw new RendererFixtureUnavailable({ resource: "domain" });
        })
      );
      const { resolveRendererComponents } = yield* Effect.promise(
        () => import("@/lib/content/renderer/components")
      );
      const failure = yield* resolveRendererComponents({
        contentKey,
        rendererDomain: "site",
        requiredComponents: [],
      }).pipe(Effect.flip);

      expect(failure).toMatchObject({
        _tag: "RendererDomainLoadError",
        contentKey,
        rendererDomain: "site",
      });
    })
  );

  it.effect("identifies the component whose implementation import failed", () =>
    Effect.gen(function* () {
      yield* Effect.sync(() =>
        vi.doMock("@/lib/content/renderer/domain/site", () => ({
          domainComponentLoaders: [
            {
              load: () =>
                Promise.reject(
                  new RendererFixtureUnavailable({ resource: "component" })
                ),
              name: "SiteWidget",
            },
          ],
        }))
      );
      const { resolveRendererComponents } = yield* Effect.promise(
        () => import("@/lib/content/renderer/components")
      );
      const failure = yield* resolveRendererComponents({
        contentKey,
        rendererDomain: "site",
        requiredComponents: [{ name: "SiteWidget", version: 1 }],
      }).pipe(Effect.flip);

      expect(failure).toMatchObject({
        _tag: "RendererDomainLoadError",
        componentName: "SiteWidget",
        contentKey,
        rendererDomain: "site",
      });
    })
  );
});
