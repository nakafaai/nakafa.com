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
// The Quran and Memory decoded limits were measured again on 13 November 2026,
// when the build began copying small shared chunks into their users (ADR 0039
// D9 holds both measurements and the trade).
// Since 21 November 2026 a route's loader loads with its route, not in the boot
// chunk, so the boot chunk is the first load's own budget (`BOOT_CHUNK_BYTES` in
// src/lib/static/boot.ts) and a warmed route fetches its loader as a file of its
// own: a graph spends less at first paint and a few more files on its warmed
// links. The homepage, Quran and Memory limits were measured again that day (ADR
// 0039 D16 holds the trade); main already measured the homepage at 942,077 /
// 2,847,224 and the Quran at 898,278 / 2,701,173 on the same Mac.

// 897,759 encoded / 2,532,335 decoded: 758,203 at first paint, and the warmed
// links on screen. With the loaders out of the boot chunk: 935,098 encoded /
// 2,796,830 decoded, 65 scripts.
const HOMEPAGE_MAX_ENCODED_BYTES = 952_000;
const HOMEPAGE_MAX_DECODED_BYTES = 2_965_000;

// 684,477 encoded / 1,922,081 decoded, its toys loaded once React takes the page
// over: 659,526 at first paint.
const PRICING_MAX_ENCODED_BYTES = 726_000;
const PRICING_MAX_DECODED_BYTES = 2_038_000;

// 833,187 encoded / 2,306,088 decoded: 730,190 at first paint, the always-on
// analytics baseline included. With the copied chunks: 822,414 encoded /
// 2,456,884 decoded. With the loaders out of the boot chunk: 899,483 encoded /
// 2,670,267 decoded, 71 scripts.
const QURAN_MAX_ENCODED_BYTES = 954_000;
const QURAN_MAX_DECODED_BYTES = 2_831_000;

// 567,013 encoded / 1,619,294 decoded, all at first paint with the animal pool
// a wide screen loads; it warms nothing. Since the Start migration every first
// paint carries the Confect client's function specs, the School member
// middleware's among them, so the limit rose from the 547,000 measured before.
const AUTH_MAX_ENCODED_BYTES = 602_000;
const AUTH_MAX_DECODED_BYTES = 1_717_000;

// The Memory page, signed in, warms its settings tabs: 1,049,988 encoded /
// 2,944,185 decoded, measured on the Start build of 8 November 2026. With the
// copied chunks: 1,049,197 encoded / 3,156,362 decoded. With the loaders out of
// the boot chunk: 1,113,233 encoded / 3,315,612 decoded, 89 scripts.
const MEMORY_MAX_ENCODED_BYTES = 1_181_000;
const MEMORY_MAX_DECODED_BYTES = 3_346_000;

// A lesson, whose first visual card is near enough to the first screen to load
// its 3D scene: 1,127,084 encoded / 3,343,730 decoded, 1,017,722 before its
// warmed neighbours. Its first visual card has drawn with MathVisual since the
// retired visuals moved onto it, and every visual serves every content kind
// (the owner's rule of 15 November 2026): 1,160,551 encoded / 3,619,129 decoded
// on 15 November 2026, so the decoded limit rose by the same rule as D9's
// (ADR 0039 D11). The encoded limit holds.
// A scene's formula labels mount in its canvas overlay and once drew with
// KaTeX there; they carry the server's markup since 16 November 2026, and the
// lesson measured 1,162,484 encoded / 3,625,112 decoded (ADR 0039 D13).
const LESSON_MAX_ENCODED_BYTES = 1_195_000;
const LESSON_MAX_DECODED_BYTES = 3_837_000;

// Google renders a page in a browser that loads about 250 of its resources and
// fails every later one, so a page over that count never starts for Google and
// AdSense reads the site as down (`BOOT_SCRIPT_LIMIT` in src/lib/static/scripts.ts
// holds the measurement). A route's whole graph, its warmed links included,
// leaves the rest of that count to its stylesheets, fonts, images and ads.
const ROUTE_MAX_SCRIPTS = 120;

// The School landing, whose forum stands under its hero, near enough to the
// first screen to load its chat and composer: 713,942 encoded / 2,141,799
// decoded, 45 scripts, measured on 16 November 2026.
const SCHOOL_MAX_ENCODED_BYTES = 757_000;
const SCHOOL_MAX_DECODED_BYTES = 2_271_000;

const routeBudgets = [
  {
    decodedBodySize: HOMEPAGE_MAX_DECODED_BYTES,
    encodedBodySize: HOMEPAGE_MAX_ENCODED_BYTES,
    href: "/en",
    name: "English homepage no-scroll graph",
    signedIn: false,
  },
  {
    decodedBodySize: SCHOOL_MAX_DECODED_BYTES,
    encodedBodySize: SCHOOL_MAX_ENCODED_BYTES,
    href: "/en/school",
    name: "English School landing no-scroll graph",
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
      measurement.worst.resourceCount,
      measurementEvidence
    ).toBeLessThanOrEqual(ROUTE_MAX_SCRIPTS);
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
