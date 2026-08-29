import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { measureRouteJavascript } from "@/e2e/support/resources";

const HOMEPAGE_MAX_ENCODED_BYTES = 1_168_654;
const HOMEPAGE_MAX_DECODED_BYTES = 3_809_519;

// Exact-head CI measured the required normal-prefetch graph three times at
// 942,256 encoded and 2,929,307 decoded bytes. These rounded limits retain a
// roughly six-percent regression margin while preserving App Shell prefetch.
const QURAN_MAX_ENCODED_BYTES = 1_000_000;
const QURAN_MAX_DECODED_BYTES = 3_100_000;

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
    const measurementEvidence = JSON.stringify(measurement);

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
      measurementEvidence
    ).toBeLessThanOrEqual(budget.encodedBodySize);
    expect(
      measurement.worst.decodedBodySize,
      measurementEvidence
    ).toBeLessThanOrEqual(budget.decodedBodySize);
  });
}
