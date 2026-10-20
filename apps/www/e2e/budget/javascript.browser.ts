import { expect, test } from "@playwright/test";
import { encodeJsonText, encodePrettyJsonText } from "@repo/utilities/json";
import { Effect } from "effect";
import { MEMORY_PATH } from "../support/memory";
import { measureRouteJavascript } from "../support/resources";
import { appRoutes } from "../support/route";

// Measured before the Start migration at 1,048,575 encoded / 3,092,340 decoded
// bytes. The Start build is not measured yet. Limits keep the ~6% margin.
const HOMEPAGE_MAX_ENCODED_BYTES = 1_112_000;
const HOMEPAGE_MAX_DECODED_BYTES = 3_278_000;

// The pricing page loads no toys before its comparison comes on screen, so its
// no-scroll graph is its own: measured before the Start migration at 929,111
// encoded / 2,755,522 decoded bytes. The Start build is not measured yet.
// Limits keep the ~6% margin.
const PRICING_MAX_ENCODED_BYTES = 985_000;
const PRICING_MAX_DECODED_BYTES = 2_921_000;

// The always-on baseline loads the SDK on every visit: measured before the
// Start migration at 1,081,541 encoded / 3,189,166 decoded bytes. The Start
// build is not measured yet. Limits keep the ~6% margin.
const QURAN_MAX_ENCODED_BYTES = 1_147_000;
const QURAN_MAX_DECODED_BYTES = 3_381_000;

// The sign-in page, with the animal pool that a wide screen loads: measured
// before the Start migration at 515,493 encoded / 1,546,566 decoded bytes. The
// Start build is not measured yet. Limits keep the ~6% margin.
const AUTH_MAX_ENCODED_BYTES = 547_000;
const AUTH_MAX_DECODED_BYTES = 1_638_000;

// The Memory page, signed in: measured before the Start migration at 954,412
// encoded / 2,810,521 decoded bytes. The Start build is not measured yet.
// Limits keep the ~6% margin.
const MEMORY_MAX_ENCODED_BYTES = 1_012_000;
const MEMORY_MAX_DECODED_BYTES = 2_980_000;

const routeBudgets = [
  {
    decodedBodySize: HOMEPAGE_MAX_DECODED_BYTES,
    encodedBodySize: HOMEPAGE_MAX_ENCODED_BYTES,
    href: "/en",
    name: "English homepage no-scroll graph",
    signedIn: false,
  },
  {
    decodedBodySize: PRICING_MAX_DECODED_BYTES,
    encodedBodySize: PRICING_MAX_ENCODED_BYTES,
    href: "/en/pricing",
    name: "English pricing no-scroll graph",
    signedIn: false,
  },
  {
    decodedBodySize: QURAN_MAX_DECODED_BYTES,
    encodedBodySize: QURAN_MAX_ENCODED_BYTES,
    href: appRoutes.quranSurahId,
    name: "Indonesian Quran normal-prefetch graph",
    signedIn: false,
  },
  {
    decodedBodySize: AUTH_MAX_DECODED_BYTES,
    encodedBodySize: AUTH_MAX_ENCODED_BYTES,
    href: "/en/auth",
    name: "English sign-in no-scroll graph",
    signedIn: false,
  },
  {
    decodedBodySize: MEMORY_MAX_DECODED_BYTES,
    encodedBodySize: MEMORY_MAX_ENCODED_BYTES,
    href: MEMORY_PATH,
    name: "English Memory signed-in graph",
    signedIn: true,
  },
] as const;

for (const budget of routeBudgets) {
  test(`${budget.name} stays within the JavaScript budget`, async ({
    baseURL,
    browser,
  }, testInfo) => {
    expect(baseURL).toBeTruthy();
    const measurement = await Effect.runPromise(
      measureRouteJavascript(browser, baseURL ?? "", budget.href, {
        signedIn: budget.signedIn,
      })
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
