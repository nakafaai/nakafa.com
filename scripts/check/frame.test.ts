import { describe, expect, it } from "@effect/vitest";
import { inspectFrameSource } from "#scripts/check/frame";

const PAGE = "apps/www/src/components/page.tsx";

describe("the page frame policy", () => {
  it("reports a page width written by hand, on its line", () => {
    expect(
      inspectFrameSource(
        PAGE,
        `const a = 1;\nconst view = "mx-auto max-w-7xl";\n`
      )
    ).toEqual([
      `${PAGE}:2: read the page's frame from shared/content/width.ts instead of max-w-7xl.`,
    ]);
  });

  it("leaves a sheet's width behind a breakpoint and a narrower measure", () => {
    expect(
      inspectFrameSource(PAGE, `const view = "sm:max-w-3xl max-w-xl";\n`)
    ).toEqual([]);
  });

  it("leaves the width module, tests, marketing pages and other packages", () => {
    const source = `const view = "max-w-3xl";\n`;
    for (const file of [
      "apps/www/src/components/shared/content/width.ts",
      "apps/www/src/components/page.test.ts",
      "apps/www/src/components/marketing/hero.tsx",
      "apps/www/src/routes/$locale/_marketing/pricing.tsx",
      "packages/design-system/components/ui/page.tsx",
    ]) {
      expect(inspectFrameSource(file, source)).toEqual([]);
    }
  });
});
