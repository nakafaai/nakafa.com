import { expect, test } from "@playwright/test";
import {
  navigationCases,
  verifyHardAndClientNavigation,
} from "./support/navigation";

const targetViewports = [
  { height: 800, name: "compact", width: 320 },
  { height: 844, hasTouch: true, name: "touch", width: 390 },
  { height: 1024, name: "tablet-portrait", width: 768 },
  { height: 768, name: "tablet-landscape", width: 1024 },
  { height: 900, name: "desktop", width: 1440 },
] as const;

for (const viewport of targetViewports) {
  for (const navigationCase of navigationCases) {
    test(`${navigationCase.name} is instant at ${viewport.name}`, async ({
      baseURL,
      browser,
    }) => {
      expect(baseURL).toBeTruthy();
      const context = await browser.newContext({
        hasTouch: "hasTouch" in viewport ? viewport.hasTouch : false,
        serviceWorkers: "block",
        viewport: { height: viewport.height, width: viewport.width },
      });

      try {
        const page = await context.newPage();
        const target = await navigationCase.resolve(page);
        await verifyHardAndClientNavigation(page, baseURL ?? "", target);
      } finally {
        await context.close();
      }
    });
  }
}
