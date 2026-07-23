import { RENDERER_DOMAINS } from "@nakafa/aksara-contracts/renderer/domain";
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

    expect(manifest.hash).toBe(
      "sha256:34ea7de14176a37239db20f0bd2ef28515413054b9af3f869c596c796a427b3a"
    );
    expect(manifest.domains.map(({ name }) => name)).toEqual(RENDERER_DOMAINS);
  });

  it("matches every pure capability to its physical implementation", async () => {
    const [
      { rendererManifest },
      { mdxComponents },
      { chemistryRegistry },
      { mathematicsRegistry },
    ] = await Promise.all([
      import("@/lib/content/renderer/manifest"),
      import("@repo/design-system/lib/markdown/registry"),
      import("@repo/design-system/lib/markdown/domain/chemistry"),
      import("@repo/design-system/lib/markdown/domain/mathematics"),
    ]);
    const manifest = await Effect.runPromise(rendererManifest);
    const registryNames = new Map<string, readonly string[]>([
      ["chemistry", sortedKeys(chemistryRegistry)],
      ["mathematics", sortedKeys(mathematicsRegistry)],
    ]);

    expect(manifest.base.authoringComponents.map(({ name }) => name)).toEqual(
      sortedKeys(mdxComponents)
    );
    for (const capability of manifest.domains) {
      const expectedNames = registryNames.get(capability.name) ?? [];
      expect(capability.authoringComponents.map(({ name }) => name)).toEqual(
        expectedNames
      );
      expect([
        ...new Set(capability.supportedComponents.map(({ name }) => name)),
      ]).toEqual(expectedNames);
      if (expectedNames.length === 0) {
        expect(capability.supportedComponents).toEqual([]);
      }
    }
  }, 10_000);
});
