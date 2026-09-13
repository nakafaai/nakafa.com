import { describe, expect, it } from "@effect/vitest";
import { ContentKeySchema } from "@nakafa/aksara-contracts/ids";
import { RENDERER_DOMAINS } from "@nakafa/aksara-contracts/renderer/domain";
import { validateRendererManifestHash } from "@nakafa/aksara-contracts/renderer/manifest";
import { semanticComponentNames } from "@repo/design-system/lib/markdown/names";
import { Effect } from "effect";
import { baseRenderers } from "@/lib/content/renderer/domain/base";
import { rendererDomainImplementations } from "@/lib/content/renderer/selection";

vi.mock("@repo/internationalization/src/navigation", () => ({
  getPathname: vi.fn(),
  Link: vi.fn(),
  redirect: vi.fn(),
  usePathname: vi.fn(),
  useRouter: vi.fn(),
}));
vi.mock("next-intl", () => ({
  /** Keeps registry discovery independent from navigation runtime behavior. */
  useTranslations: () => () => "",
}));

describe("renderer manifest", () => {
  it.effect("authenticates the canonical renderer contract", () =>
    Effect.gen(function* () {
      const { rendererManifest } = yield* Effect.promise(
        () => import("@/lib/content/renderer/manifest")
      );
      const manifest = yield* rendererManifest;

      expect(yield* validateRendererManifestHash(manifest)).toEqual(manifest);
      expect(manifest.domains.map(({ name }) => name)).toEqual(
        RENDERER_DOMAINS
      );
      expect(manifest.publishedDomains).toEqual(RENDERER_DOMAINS);
      for (const names of [
        manifest.base,
        ...manifest.domains.map(({ components }) => components),
      ]) {
        expect(new Set(names).size).toBe(names.length);
      }
    })
  );

  it.effect(
    "matches every manifest requirement to one physical implementation",
    () =>
      Effect.gen(function* () {
        const [{ resolveRendererComponents }, { rendererManifest }] =
          yield* Effect.all(
            [
              Effect.promise(() => import("@/lib/content/renderer/components")),
              Effect.promise(() => import("@/lib/content/renderer/manifest")),
            ],
            { concurrency: "unbounded" }
          );
        const manifest = yield* rendererManifest;
        const contentKey = ContentKeySchema.make("test:renderer-manifest");

        for (const domain of manifest.domains) {
          const requiredComponents = [...manifest.base, ...domain.components];
          const components = yield* resolveRendererComponents({
            contentKey,
            rendererDomain: domain.name,
            requiredComponents,
          });
          const expectedNames = [...new Set(requiredComponents)].sort();

          expect(Object.keys(components).sort()).toEqual(expectedNames);
        }
      }),
    120_000
  );

  it.effect(
    "keeps every registered domain exactly aligned with the manifest",
    () =>
      Effect.gen(function* () {
        const { rendererManifest } = yield* Effect.promise(
          () => import("@/lib/content/renderer/manifest")
        );
        const manifest = yield* rendererManifest;
        const semanticNames = new Set<string>(semanticComponentNames);
        const expectedBaseNames = manifest.base
          .filter((name) => !semanticNames.has(name))
          .sort();

        expect(baseRenderers.map(({ name }) => name).sort()).toEqual(
          expectedBaseNames
        );

        for (const domain of manifest.domains) {
          const expectedDomainNames = [...domain.components].sort();

          expect(
            rendererDomainImplementations[domain.name]
              .map(({ name }) => name)
              .sort()
          ).toEqual(expectedDomainNames);
        }
      })
  );
});
