import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { measureRouteJavascript } from "./support/resources";

const HOMEPAGE_MAX_ENCODED_BYTES = 1_168_654;
const HOMEPAGE_MAX_DECODED_BYTES = 3_809_519;
const QURAN_MAX_ENCODED_BYTES = 800_000;
const QURAN_MAX_DECODED_BYTES = 2_500_000;

const routeBudgets = [
  {
    decodedBodySize: HOMEPAGE_MAX_DECODED_BYTES,
    encodedBodySize: HOMEPAGE_MAX_ENCODED_BYTES,
    href: "/en",
    name: "English homepage no-scroll graph",
  },
  {
    decodedBodySize: QURAN_MAX_DECODED_BYTES,
    encodedBodySize: QURAN_MAX_ENCODED_BYTES,
    href: "/id/quran/2",
    name: "Indonesian Quran normal-prefetch graph",
  },
] as const;

for (const budget of routeBudgets) {
  test(`${budget.name} stays within the JavaScript budget`, async ({
    baseURL,
    browser,
  }, testInfo) => {
    expect(baseURL).toBeTruthy();
    const measurement = await Effect.runPromise(
      measureRouteJavascript(browser, baseURL ?? "", budget.href)
    );

    await testInfo.attach(
      `${budget.href.replaceAll("/", "_")}-resources.json`,
      {
        body: Buffer.from(JSON.stringify(measurement, null, 2)),
        contentType: "application/json",
      }
    );

    expect(measurement.worst.resourceCount).toBeGreaterThan(0);
    expect(
      measurement.worst.encodedBodySize,
      JSON.stringify(measurement.worst)
    ).toBeLessThanOrEqual(budget.encodedBodySize);
    expect(
      measurement.worst.decodedBodySize,
      JSON.stringify(measurement.worst)
    ).toBeLessThanOrEqual(budget.decodedBodySize);
  });
}
