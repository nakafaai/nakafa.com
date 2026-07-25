import { RENDERER_DOMAINS } from "@nakafa/aksara-contracts/renderer/domain";
import { validateRendererManifestHash } from "@nakafa/aksara-contracts/renderer/manifest";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
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
  }, 10_000);
});
