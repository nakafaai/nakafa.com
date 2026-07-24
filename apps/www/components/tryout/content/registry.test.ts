// @vitest-environment node

import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";
import { resolveTryoutComponents } from "@/components/tryout/content/registry";

const registries = vi.hoisted(() => ({
  general: { General: "general" },
  mathematics: { Mathematics: "mathematics" },
  plain: { Plain: "plain" },
  quantitative: { Quantitative: "quantitative" },
  tka: { Tka: "tka" },
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/design-system/lib/markdown/domain/snbt/general", () => ({
  snbtGeneralComponents: registries.general,
}));
vi.mock("@repo/design-system/lib/markdown/domain/snbt/mathematics", () => ({
  snbtMathComponents: registries.mathematics,
}));
vi.mock("@repo/design-system/lib/markdown/domain/snbt/plain", () => ({
  snbtPlainComponents: registries.plain,
}));
vi.mock("@repo/design-system/lib/markdown/domain/snbt/quantitative", () => ({
  snbtQuantComponents: registries.quantitative,
}));
vi.mock("@repo/design-system/lib/markdown/domain/tka/mathematics", () => ({
  tkaMathComponents: registries.tka,
}));

describe("try-out content registry", () => {
  it.each([
    ["snbt-general", "general"],
    ["snbt-math", "mathematics"],
    ["snbt-plain", "plain"],
    ["snbt-quant", "quantitative"],
    ["tka-math", "tka"],
  ] as const)("resolves %s to its physical route registry", async (domain, key) => {
    await expect(
      Effect.runPromise(resolveTryoutComponents(domain))
    ).resolves.toBe(registries[key]);
  });

  it("fails closed for a valid non-try-out renderer domain", async () => {
    await expect(
      Effect.runPromise(
        resolveTryoutComponents("mathematics").pipe(Effect.flip)
      )
    ).resolves.toMatchObject({
      _tag: "TryoutRendererDomainError",
      domain: "mathematics",
    });
  });
});
