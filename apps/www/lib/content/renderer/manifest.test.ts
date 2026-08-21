import { createHash } from "node:crypto";
import {
  canonicalizeRendererManifestContract,
  RendererManifestEnvelopeSchema,
} from "@nakafa/aksara-contracts/renderer/contract";
import { RENDERER_DOMAINS } from "@nakafa/aksara-contracts/renderer/domain";
import {
  validateLiveRendererManifestHash,
  validateRendererManifestHash,
} from "@nakafa/aksara-contracts/renderer/manifest";
import { Effect, Exit, Schema } from "effect";
import { describe, expect, it, vi } from "vitest";

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

/** Sorts component names using the manifest's canonical code-unit ordering. */
function sortedKeys(registry: object) {
  return Object.keys(registry).sort();
}

describe("renderer manifest", () => {
  it("authenticates the canonical renderer contract", async () => {
    const { rendererManifest } = await import(
      "@/lib/content/renderer/manifest"
    );
    const manifest = await Effect.runPromise(rendererManifest);

    await expect(
      Effect.runPromise(validateRendererManifestHash(manifest))
    ).resolves.toEqual(manifest);
    expect(manifest.domains.map(({ name }) => name)).toEqual(RENDERER_DOMAINS);
    expect(manifest.publishedDomains).toEqual(RENDERER_DOMAINS);
  });

  it("accepts historical domain subsets only as frozen evidence", async () => {
    const { rendererManifest } = await import(
      "@/lib/content/renderer/manifest"
    );
    const manifest = await Effect.runPromise(rendererManifest);
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
    const historicalManifest = Schema.decodeSync(
      RendererManifestEnvelopeSchema
    )({
      ...manifest,
      domains,
      hash,
      publishedDomains,
    });

    expect(historicalManifest.hash).toBe(
      "sha256:e06c5326020aeb0c43c0c565948b18a111a4df009ff3b3fe5cd827f35f9275e7"
    );

    await expect(
      Effect.runPromise(validateRendererManifestHash(historicalManifest))
    ).resolves.toEqual(historicalManifest);

    const liveValidation = await Effect.runPromiseExit(
      validateLiveRendererManifestHash(historicalManifest)
    );
    expect(Exit.isFailure(liveValidation)).toBe(true);
  });

  it("matches every pure capability to its physical implementation", async () => {
    const [
      { rendererManifest },
      { mdxComponents },
      { aiDsRegistry },
      { biologyRegistry },
      { chemistryRegistry },
      { mathematicsRegistry },
      { physicsRegistry },
      { politicsRegistry },
      { siteRegistry },
      { snbtGeneralRegistry },
      { snbtMathRegistry },
      { snbtPlainRegistry },
      { snbtQuantRegistry },
      { tkaMathRegistry },
    ] = await Promise.all([
      import("@/lib/content/renderer/manifest"),
      import("@repo/design-system/lib/markdown/registry"),
      import("@repo/design-system/lib/markdown/domain/ai-ds"),
      import("@repo/design-system/lib/markdown/domain/biology"),
      import("@repo/design-system/lib/markdown/domain/chemistry"),
      import("@repo/design-system/lib/markdown/domain/mathematics"),
      import("@repo/design-system/lib/markdown/domain/physics"),
      import("@repo/design-system/lib/markdown/domain/politics"),
      import("@repo/design-system/lib/markdown/domain/site"),
      import("@repo/design-system/lib/markdown/domain/snbt/general"),
      import("@repo/design-system/lib/markdown/domain/snbt/mathematics"),
      import("@repo/design-system/lib/markdown/domain/snbt/plain"),
      import("@repo/design-system/lib/markdown/domain/snbt/quantitative"),
      import("@repo/design-system/lib/markdown/domain/tka/mathematics"),
    ]);
    const manifest = await Effect.runPromise(rendererManifest);
    const registryNames = new Map<string, readonly string[]>([
      ["ai-ds", sortedKeys(aiDsRegistry)],
      ["biology", sortedKeys(biologyRegistry)],
      ["chemistry", sortedKeys(chemistryRegistry)],
      ["mathematics", sortedKeys(mathematicsRegistry)],
      ["physics", sortedKeys(physicsRegistry)],
      ["politics", sortedKeys(politicsRegistry)],
      ["site", sortedKeys(siteRegistry)],
      ["snbt-general", sortedKeys(snbtGeneralRegistry)],
      ["snbt-math", sortedKeys(snbtMathRegistry)],
      ["snbt-plain", sortedKeys(snbtPlainRegistry)],
      ["snbt-quant", sortedKeys(snbtQuantRegistry)],
      ["tka-math", sortedKeys(tkaMathRegistry)],
    ]);

    expect(manifest.base.authoringComponents.map(({ name }) => name)).toEqual(
      sortedKeys(mdxComponents)
    );
    for (const capability of manifest.domains) {
      const expectedNames = registryNames.get(capability.name);
      expect(expectedNames).toBeDefined();
      expect(capability.authoringComponents.map(({ name }) => name)).toEqual(
        expectedNames
      );
      expect([
        ...new Set(capability.supportedComponents.map(({ name }) => name)),
      ]).toEqual(expectedNames);
      if (expectedNames?.length === 0) {
        expect(capability.supportedComponents).toEqual([]);
      }
    }
  }, 20_000);
});
