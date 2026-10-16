import { expect, test } from "@playwright/test";
import { encodeJsonText, encodePrettyJsonText } from "@repo/utilities/json";
import { Effect } from "effect";
import { measureRouteJavascript } from "@/e2e/support/resources";
import { appRoutes } from "@/e2e/support/route";

// Remeasured at 1,048,575 encoded / 3,092,340 decoded bytes.
// Limits keep the ~6% margin.
const HOMEPAGE_MAX_ENCODED_BYTES = 1_112_000;
const HOMEPAGE_MAX_DECODED_BYTES = 3_278_000;

// The always-on baseline loads the SDK on every visit: remeasured at
// 1,081,541 encoded / 3,189,166 decoded bytes. Limits keep the ~6% margin.
const QURAN_MAX_ENCODED_BYTES = 1_147_000;
const QURAN_MAX_DECODED_BYTES = 3_381_000;

// The sign-in page, with the animal pool that a wide screen loads: measured at
// 515,493 encoded / 1,546,566 decoded bytes. Limits keep the ~6% margin.
const AUTH_MAX_ENCODED_BYTES = 547_000;
const AUTH_MAX_DECODED_BYTES = 1_638_000;

const routeBudgets = [
  {
    decodedBodySize: HOMEPAGE_MAX_DECODED_BYTES,
    encodedBodySize: HOMEPAGE_MAX_ENCODED_BYTES,
    href: "/en",
    name: "English homepage no-scroll graph",
    prefetches: true,
  },
  {
    decodedBodySize: QURAN_MAX_DECODED_BYTES,
    encodedBodySize: QURAN_MAX_ENCODED_BYTES,
    href: appRoutes.quranSurahId,
    name: "Indonesian Quran normal-prefetch graph",
    prefetches: true,
  },
  {
    decodedBodySize: AUTH_MAX_DECODED_BYTES,
    encodedBodySize: AUTH_MAX_ENCODED_BYTES,
    href: "/en/auth",
    name: "English sign-in no-scroll graph",
    prefetches: false,
  },
] as const;

for (const budget of routeBudgets) {
  test(`${budget.name} stays within the JavaScript budget`, async ({
    baseURL,
    browser,
  }, testInfo) => {
    expect(baseURL).toBeTruthy();
    const measurement = await Effect.runPromise(
      measureRouteJavascript(
        browser,
        baseURL ?? "",
        budget.href,
        budget.prefetches
      )
    );
    const measurementEvidence = encodeJsonText(measurement);

    await testInfo.attach(
      `${budget.href.replaceAll("/", "_")}-resources.json`,
      {
        body: Buffer.from(encodePrettyJsonText(measurement)),
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
