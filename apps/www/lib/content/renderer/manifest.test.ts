import { createHash } from "node:crypto";
import { describe, expect, it } from "@effect/vitest";
import { ContentKeySchema } from "@nakafa/aksara-contracts/ids";
import {
  canonicalizeRendererManifestContract,
  RendererManifestEnvelopeSchema,
} from "@nakafa/aksara-contracts/renderer/contract";
import { RENDERER_DOMAINS } from "@nakafa/aksara-contracts/renderer/domain";
import {
  validateLiveRendererManifestHash,
  validateRendererManifestHash,
} from "@nakafa/aksara-contracts/renderer/manifest";
import { semanticComponentNames } from "@repo/design-system/lib/markdown/names";
import { Effect, Exit, Schema } from "effect";
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
    })
  );

  it.effect("accepts historical domain subsets only as frozen evidence", () =>
    Effect.gen(function* () {
      const { rendererManifest } = yield* Effect.promise(
        () => import("@/lib/content/renderer/manifest")
      );
      const manifest = yield* rendererManifest;
      const domains = manifest.domains.filter(({ name }) => name !== "site");
      const publishedDomains = manifest.publishedDomains.filter(
        (name) => name !== "site"
      );
      const canonicalContract = canonicalizeRendererManifestContract({
        base: manifest.base,
        domains,
        publishedDomains,
      });
      const hash = `sha256:${createHash("sha256")
        .update(canonicalContract)
        .digest("hex")}`;
      const historicalManifest = yield* Schema.decodeEffect(
        RendererManifestEnvelopeSchema
      )({
        ...manifest,
        domains,
        hash,
        publishedDomains,
      });

      expect(historicalManifest.hash).toBe(
        "sha256:498f63f26201b30b93d4972292b4cd4489b05b1e216529081da1b7a01e3d0483"
      );
      expect(yield* validateRendererManifestHash(historicalManifest)).toEqual(
        historicalManifest
      );

      const liveValidation = yield* Effect.exit(
        validateLiveRendererManifestHash(historicalManifest)
      );
      expect(Exit.isFailure(liveValidation)).toBe(true);
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
          const requiredComponents = [
            ...manifest.base.supportedComponents,
            ...domain.supportedComponents,
          ];
          const components = yield* resolveRendererComponents({
            contentKey,
            rendererDomain: domain.name,
            requiredComponents,
          });
          const expectedNames = [
            ...new Set(requiredComponents.map(({ name }) => name)),
          ].sort();

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
        const expectedBaseNames = manifest.base.supportedComponents
          .map(({ name }) => name)
          .filter((name) => !semanticNames.has(name))
          .sort();

        expect(baseRenderers.map(({ name }) => name).sort()).toEqual(
          expectedBaseNames
        );

        for (const domain of manifest.domains) {
          const expectedDomainNames = domain.supportedComponents
            .map(({ name }) => name)
            .sort();

          expect(
            rendererDomainImplementations[domain.name]
              .map(({ name }) => name)
              .sort()
          ).toEqual(expectedDomainNames);
        }
      })
  );
});
