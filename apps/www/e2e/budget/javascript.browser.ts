import { expect, test } from "@playwright/test";
import { encodeJsonText } from "@repo/utilities/json";
import { Effect, Schema } from "effect";
import { measureRouteJavascript } from "@/e2e/support/resources";
import { appRoutes } from "@/e2e/support/route";

const prettyMeasurementJson = Schema.fromJsonString(Schema.Unknown, {
  space: 2,
});

const HOMEPAGE_MAX_ENCODED_BYTES = 1_168_654;
const HOMEPAGE_MAX_DECODED_BYTES = 3_809_519;

// The always-on baseline loads the SDK on every visit: remeasured at
// 1,126,805 encoded / 3,467,447 decoded bytes. Limits keep the ~6% margin.
const QURAN_MAX_ENCODED_BYTES = 1_195_000;
const QURAN_MAX_DECODED_BYTES = 3_676_000;

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
    href: appRoutes.quranSurahId,
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
    const measurementEvidence = encodeJsonText(measurement);

    await testInfo.attach(
      `${budget.href.replaceAll("/", "_")}-resources.json`,
      {
        body: Buffer.from(
          Schema.encodeSync(prettyMeasurementJson)(measurement)
        ),
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
