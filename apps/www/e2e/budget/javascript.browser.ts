import { expect, test } from "@playwright/test";
import { encodeJsonText, encodePrettyJsonText } from "@repo/utilities/json";
import { Effect } from "effect";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { MEMORY_PATH } from "@/e2e/support/memory";
import { measureRouteJavascript } from "@/e2e/support/resources";
import { appRoutes } from "@/e2e/support/route";

// Each graph counts every script a route loads until the JavaScript stops
// arriving: its first paint, then the pages `warmLinks` warms once the page
// settles (up to six links on screen, a page's tabs first), because a reader's
// phone pays for both. A warm is a preload, so it takes a page's code and data
// but never the sections under its first screen (ADR 0039 D3). Measured on the
// Start build of 8 November 2026 (production build, 1440 by 900, three uncached
// runs, all equal). Each limit keeps the ~6% margin over its measurement.

// 897,759 encoded / 2,532,335 decoded: 758,203 at first paint, and the warmed
// links on screen.
const HOMEPAGE_MAX_ENCODED_BYTES = 952_000;
const HOMEPAGE_MAX_DECODED_BYTES = 2_685_000;

// 684,477 encoded / 1,922,081 decoded, its toys loaded once React takes the page
// over: 659,526 at first paint.
const PRICING_MAX_ENCODED_BYTES = 726_000;
const PRICING_MAX_DECODED_BYTES = 2_038_000;

// 833,187 encoded / 2,306,088 decoded: 730,190 at first paint, the always-on
// analytics baseline included.
const QURAN_MAX_ENCODED_BYTES = 884_000;
const QURAN_MAX_DECODED_BYTES = 2_445_000;

// 567,013 encoded / 1,619,294 decoded, all at first paint with the animal pool
// a wide screen loads; it warms nothing. Since the Start migration every first
// paint carries the Confect client's function specs, the School member
// middleware's among them, so the limit rose from the 547,000 measured before.
const AUTH_MAX_ENCODED_BYTES = 602_000;
const AUTH_MAX_DECODED_BYTES = 1_717_000;

// The Memory page, signed in, warms its settings tabs: 1,049,988 encoded /
// 2,944,185 decoded, measured on the Start build of 8 November 2026.
const MEMORY_MAX_ENCODED_BYTES = 1_113_000;
const MEMORY_MAX_DECODED_BYTES = 3_121_000;

// A lesson, whose first visual card is near enough to the first screen to load
// its 3D scene: 1,127,084 encoded / 3,343,730 decoded, 1,017,722 before its
// warmed neighbours.
const LESSON_MAX_ENCODED_BYTES = 1_195_000;
const LESSON_MAX_DECODED_BYTES = 3_545_000;

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
  {
    decodedBodySize: LESSON_MAX_DECODED_BYTES,
    encodedBodySize: LESSON_MAX_ENCODED_BYTES,
    href: pinnedRoutes.material.en,
    name: "English lesson no-scroll graph",
    signedIn: false,
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
