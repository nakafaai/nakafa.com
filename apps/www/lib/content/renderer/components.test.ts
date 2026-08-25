// @vitest-environment node

import { ContentKeySchema } from "@nakafa/aksara-contracts/ids";
import { semanticMdxComponents } from "@repo/design-system/lib/markdown/semantic";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

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
  it("loads semantic HTML plus exactly the signed custom requirements", async () => {
    const { resolveRendererComponents } = await import(
      "@/lib/content/renderer/components"
    );
    const components = await Effect.runPromise(
      resolveRendererComponents({
        contentKey,
        rendererDomain: "snbt-plain",
        requiredComponents: [{ name: "InlineMath", version: 1 }],
      })
    );

    expect(components).toMatchObject(semanticMdxComponents);
    expect(Object.keys(components).sort()).toEqual(
      [...Object.keys(semanticMdxComponents), "InlineMath"].sort()
    );
    expect(components).not.toHaveProperty("BlockMath");
    expect(components).not.toHaveProperty("Mermaid");
  });

  it("fails with the signed identity when an implementation is missing", async () => {
    const { resolveRendererComponents } = await import(
      "@/lib/content/renderer/components"
    );

    await expect(
      Effect.runPromise(
        resolveRendererComponents({
          contentKey,
          rendererDomain: "site",
          requiredComponents: [{ name: "MissingRenderer", version: 1 }],
        }).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({
      _tag: "RendererImplementationMissing",
      componentName: "MissingRenderer",
      contentKey,
      rendererDomain: "site",
    });
  });

  it("fails when semantic ownership and implementation coverage drift", async () => {
    vi.doMock("@repo/design-system/lib/markdown/semantic", () => ({
      semanticMdxComponents: {},
    }));
    const { resolveRendererComponents } = await import(
      "@/lib/content/renderer/components"
    );

    await expect(
      Effect.runPromise(
        resolveRendererComponents({
          contentKey,
          rendererDomain: "site",
          requiredComponents: [{ name: "p", version: 1 }],
        }).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({
      _tag: "RendererImplementationMissing",
      componentName: "p",
      contentKey,
      rendererDomain: "site",
    });
  });

  it("rejects a base and selected-domain ownership collision", async () => {
    vi.doMock("@/lib/content/renderer/domain/site", () => ({
      domainComponentLoaders: [
        { load: () => Promise.resolve(() => null), name: "InlineMath" },
      ],
    }));
    const { resolveRendererComponents } = await import(
      "@/lib/content/renderer/components"
    );

    await expect(
      Effect.runPromise(
        resolveRendererComponents({
          contentKey,
          rendererDomain: "site",
          requiredComponents: [{ name: "InlineMath", version: 1 }],
        }).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({
      _tag: "RendererComponentCollision",
      componentName: "InlineMath",
      contentKey,
      rendererDomain: "site",
    });
  });

  it("rejects duplicate implementations inside the selected domain", async () => {
    vi.doMock("@/lib/content/renderer/domain/site", () => ({
      domainComponentLoaders: [
        { load: () => Promise.resolve(() => null), name: "SiteWidget" },
        { load: () => Promise.resolve(() => null), name: "SiteWidget" },
      ],
    }));
    const { resolveRendererComponents } = await import(
      "@/lib/content/renderer/components"
    );

    await expect(
      Effect.runPromise(
        resolveRendererComponents({
          contentKey,
          rendererDomain: "site",
          requiredComponents: [{ name: "SiteWidget", version: 1 }],
        }).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({
      _tag: "RendererComponentCollision",
      componentName: "SiteWidget",
      contentKey,
      rendererDomain: "site",
    });
  });

  it("preserves domain import failures in the typed error channel", async () => {
    vi.doMock("@/lib/content/renderer/domain/site", () => {
      throw new Error("domain unavailable");
    });
    const { resolveRendererComponents } = await import(
      "@/lib/content/renderer/components"
    );

    await expect(
      Effect.runPromise(
        resolveRendererComponents({
          contentKey,
          rendererDomain: "site",
          requiredComponents: [],
        }).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({
      _tag: "RendererDomainLoadError",
      contentKey,
      rendererDomain: "site",
    });
  });

  it("identifies the component whose implementation import failed", async () => {
    vi.doMock("@/lib/content/renderer/domain/site", () => ({
      domainComponentLoaders: [
        {
          load: () => Promise.reject(new Error("component unavailable")),
          name: "SiteWidget",
        },
      ],
    }));
    const { resolveRendererComponents } = await import(
      "@/lib/content/renderer/components"
    );

    await expect(
      Effect.runPromise(
        resolveRendererComponents({
          contentKey,
          rendererDomain: "site",
          requiredComponents: [{ name: "SiteWidget", version: 1 }],
        }).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({
      _tag: "RendererDomainLoadError",
      componentName: "SiteWidget",
      contentKey,
      rendererDomain: "site",
    });
  });
});
