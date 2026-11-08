import { describe, expect, it } from "@effect/vitest";
import { ContentKeySchema } from "@nakafa/aksara-contracts/ids";
import { RENDERER_DOMAINS } from "@nakafa/aksara-contracts/renderer/domain";
import { validateRendererManifestHash } from "@nakafa/aksara-contracts/renderer/manifest";
import { semanticComponentNames } from "@repo/design-system/lib/markdown/names";
import { Array as Arr, Effect, HashSet, Order, Record as Rec } from "effect";
import { rendererImplementations } from "@/lib/content/renderer/selection";

vi.mock("use-intl", () => ({
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
      expect(Arr.map(manifest.domains, ({ name }) => name)).toEqual(
        RENDERER_DOMAINS
      );
      expect(manifest.publishedDomains).toEqual(RENDERER_DOMAINS);
      for (const names of [
        manifest.base,
        ...Arr.map(manifest.domains, ({ components }) => components),
      ]) {
        expect(Arr.dedupe(names).length).toBe(names.length);
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
          const expectedNames = Arr.sort(
            Arr.dedupe(requiredComponents),
            Order.String
          );

          expect(
            Arr.sort(Rec.keys<string, unknown>(components), Order.String)
          ).toEqual(expectedNames);
        }
      }),
    120_000
  );

  it.effect(
    "registers every visual for every domain, exactly as the manifest names them",
    () =>
      Effect.gen(function* () {
        const { rendererManifest } = yield* Effect.promise(
          () => import("@/lib/content/renderer/manifest")
        );
        const manifest = yield* rendererManifest;
        const semanticNames = HashSet.fromIterable<string>(
          semanticComponentNames
        );

        expect(
          Arr.sort(
            Arr.map(rendererImplementations, ({ name }) => name),
            Order.String
          )
        ).toEqual(
          Arr.sort(
            Arr.filter(manifest.base, (name) => !HashSet.has(semanticNames, name)),
            Order.String
          )
        );
        expect(
          Arr.every(manifest.domains, ({ components }) =>
            Arr.isReadonlyArrayEmpty(components)
          )
        ).toBe(true);
      })
  );
});
