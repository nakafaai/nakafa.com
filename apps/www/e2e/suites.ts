/**
 * Which specs each Playwright project of `apps/www/playwright.config.ts` runs.
 * Projects select files by folder path, so a file that repeats a basename never
 * joins a project by accident.
 */
import { Array as Arr } from "effect";

// Specs that assert how long something takes or what each frame draws: a press
// that must answer within a budget, a page that must paint once, a popup that
// must open without a loader, a check under Chromium's CPU throttle. Another
// test beside them on a loaded machine moves those numbers, so they run in the
// timing suites, one test at a time, after the suites that run in parallel.
export const TIMING_TESTS = [
  "**/auth/static.browser.ts",
  "**/static/answers.browser.ts",
  "**/curriculum/placement.browser.ts",
  "**/navigation/families.browser.ts",
  "**/navigation/flicker.browser.ts",
  "**/navigation/instant.browser.ts",
  "**/navigation/prefetch.browser.ts",
  "**/state/popups.browser.ts",
  "**/reading/idle.browser.ts",
  "**/reading/press.browser.ts",
  "**/reading/shift.browser.ts",
  "**/settings/sections.browser.ts",
  "**/tryout/attempt.browser.ts",
  "**/tryout/player.browser.ts",
  "**/tryout/shell.browser.ts",
  "**/tryout/start.browser.ts",
  "**/chat/settle.browser.ts",
  "**/chat/shift.browser.ts",
  "**/nina/early.browser.ts",
  "**/marketing/home.browser.ts",
  "**/marketing/settle.browser.ts",
  "**/school/empty.browser.ts",
  "**/school/founding.browser.ts",
  "**/school/instant.browser.ts",
  "**/school/paint.browser.ts",
  "**/school/roles.browser.ts",
  "**/school/shift.browser.ts",
  "**/school/walk.browser.ts",
];

// The visual cards, scenes and marketing pages.
export const VISUAL_TESTS = [
  "**/visual/**/*.browser.ts",
  "**/scene/**/*.browser.ts",
  "**/marketing/**/*.browser.ts",
  "**/consent/**/*.browser.ts",
  "**/content/charts.browser.ts",
];

// The account, settings and try-out pages of a signed-in learner.
export const LEARNER_TESTS = [
  "**/account/**/*.browser.ts",
  "**/settings/**/*.browser.ts",
  "**/tryout/**/*.browser.ts",
];

// Nina's chats, on their page and in the sheet.
export const CHAT_TESTS = [
  "**/chat/**/*.browser.ts",
  "**/nina/**/*.browser.ts",
];

// Every School page, role and worst case, which the browsers suites run again in
// Firefox, desktop Safari, an Android phone and an iPhone, after Chromium's run
// in the runtime suite: a school must work on every device its people bring.
export const SCHOOL_TESTS = "**/school/**/*.browser.ts";

// What only Chromium can measure: its CPU throttle and layout shift entries, and its
// test of whether a placeholder fits. Firefox and WebKit run the rest.
export const CHROMIUM_SCHOOL_TESTS = [
  "**/school/placeholders.browser.ts",
  "**/school/shift.browser.ts",
];

// The School specs that check only what the server keeps and answers: data, roles, text, addresses and
// navigation, through plain fields, buttons and menus. Chromium runs them in the runtime suite, and another
// engine would only repeat the same answers, so the browsers suites leave them out. Every spec that measures
// rendering, layout, paint, fonts, focus, scroll, touch, typing into the editor, a file, a download, the
// connection or history stays in all five engines, and so do the walks and the roles.
export const BEHAVIOUR_SCHOOL_TESTS = Arr.map(
  [
    "access",
    "announcement",
    "billing",
    "checkout",
    "classrooms",
    "delete",
    "device",
    "duplicate",
    "duties",
    "entry",
    "expired",
    "family",
    "forum",
    "full",
    "grades",
    "grading",
    "homework",
    "host",
    "icons",
    "insight",
    "lock",
    "outsider",
    "people",
    "preferences",
    "reports",
    "requests",
    "reschedule",
    "results",
    "revoked",
    "room",
    "scheme",
    "screen",
    "setup",
    "status",
    "tabs",
    "units",
    "webhooks",
  ],
  (name) => `**/school/${name}.browser.ts`
);

// The specs that read what only Chromium's DevTools protocol reports: route
// JavaScript sizes, box models, layout shift entries and placeholder fits. The
// Firefox and WebKit projects of each UI suite run every other spec.
export const CHROMIUM_TESTS = [
  "**/budget/javascript.browser.ts",
  "**/consent/preferences.browser.ts",
  "**/quran/flow.browser.ts",
  "**/quran/typeface.browser.ts",
  "**/school/edges.browser.ts",
  "**/settings/panel.browser.ts",
  "**/support/layout.browser.ts",
];

// The School pages of the timing specs, which the browser timing suite runs in
// the other four browsers.
export const SCHOOL_TIMING_TESTS = Arr.filter(TIMING_TESTS, (path) =>
  path.startsWith("**/school/")
);

// The lesson breadcrumb that must paint once, and a press into a lesson that
// must draw it whole, in Safari too.
export const WEBKIT_TIMING_TESTS = [
  "**/curriculum/placement.browser.ts",
  "**/reading/press.browser.ts",
];
