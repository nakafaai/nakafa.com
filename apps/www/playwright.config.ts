import { defineConfig, devices, type Project } from "@playwright/test";
import { acceptanceOrigin } from "@repo/backend/scripts/content/acceptance/origin";
import {
  Array as Arr,
  Effect,
  Number as Num,
  Option,
  Record as Rec,
} from "effect";

// The browser tests open the acceptance runtime's origin, localhost on the port
// that ACCEPTANCE_PORT names (3000 by default), so set the same ACCEPTANCE_PORT
// that prepared the runtime. A developer server under Portless takes its URL
// from PLAYWRIGHT_BASE_URL, for example `bunx portless get nakafa`.
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? Effect.runSync(acceptanceOrigin);

// Projects select files by folder path, so a file that repeats a basename
// never joins a project by accident.

// Specs that assert how long something takes or what each frame draws: a press
// that must answer within a budget, a page that must paint once, a popup that
// must open without a loader, a check under Chromium's CPU throttle. Another
// test beside them on a loaded machine moves those numbers, so they run in the
// timing suites, one test at a time, after the suites that run in parallel.
const TIMING_TESTS = [
  "**/auth/static.browser.ts",
  "**/static/answers.browser.ts",
  "**/curriculum/placement.browser.ts",
  "**/navigation/families.browser.ts",
  "**/navigation/flicker.browser.ts",
  "**/navigation/instant.browser.ts",
  "**/navigation/prefetch.browser.ts",
  "**/state/popups.browser.ts",
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
const VISUAL_TESTS = [
  "**/visual/**/*.browser.ts",
  "**/scene/**/*.browser.ts",
  "**/marketing/**/*.browser.ts",
  "**/consent/**/*.browser.ts",
  "**/content/charts.browser.ts",
];

// The account, settings and try-out pages of a signed-in learner.
const LEARNER_TESTS = [
  "**/account/**/*.browser.ts",
  "**/settings/**/*.browser.ts",
  "**/tryout/**/*.browser.ts",
];

// Nina's chats, on their page and in the sheet.
const CHAT_TESTS = ["**/chat/**/*.browser.ts", "**/nina/**/*.browser.ts"];

// Every School page, role and worst case, which the browsers suites run again in
// Firefox, desktop Safari, an Android phone and an iPhone, after Chromium's run
// in the runtime suite: a school must work on every device its people bring.
const SCHOOL_TESTS = "**/school/**/*.browser.ts";

// What only Chromium can measure: its CPU throttle and layout shift entries, and its
// test of whether a placeholder fits. Firefox and WebKit run the rest.
const CHROMIUM_SCHOOL_TESTS = [
  "**/school/placeholders.browser.ts",
  "**/school/shift.browser.ts",
];

// The School specs that check only what the server keeps and answers: data, roles, text, addresses and
// navigation, through plain fields, buttons and menus. Chromium runs them in the runtime suite, and another
// engine would only repeat the same answers, so the browsers suites leave them out. Every spec that measures
// rendering, layout, paint, fonts, focus, scroll, touch, typing into the editor, a file, a download, the
// connection or history stays in all five engines, and so do the walks and the roles.
const BEHAVIOUR_SCHOOL_TESTS = Arr.map(
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

// The visual cards take the whole screen through the Fullscreen API on desktop,
// Android, and iPad, and cover the viewport on iPhone, and the outline follows the
// reader down and up a lesson, in Safari too.
const WEBKIT_TESTS = [
  "**/visual/cards.browser.ts",
  "**/reading/outline.browser.ts",
];

// The School pages of the timing specs, which the browser timing suite runs in
// the other four browsers.
const SCHOOL_TIMING_TESTS = Arr.filter(TIMING_TESTS, (path) =>
  path.startsWith("**/school/")
);

// The lesson breadcrumb that must paint once, and a press into a lesson that
// must draw it whole, in Safari too.
const WEBKIT_TIMING_TESTS = [
  "**/curriculum/placement.browser.ts",
  "**/reading/press.browser.ts",
];

/** The cores of this machine, which the local backend runs as many isolates on. */
const CORES = navigator.hardwareConcurrency;

/**
 * How many workers run a suite whose tests measure no timing: half the cores,
 * unless PLAYWRIGHT_WORKERS names another count. Every test seeds its own
 * learner, school and chats and marks what it writes with the moment of its
 * run, so any two tests can run side by side. The local backend runs one
 * isolate per core and stops a function after five seconds of its own code
 * (`packages/backend/scripts/content/acceptance/process.ts`), and each worker
 * drives a browser and the app's server besides, so a count is capped at the
 * cores: past them every function waits for a core and nears that limit.
 */
function parallelWorkers(value: string | undefined): number {
  if (value === undefined) {
    return Num.max(1, Math.floor(CORES / 2));
  }
  const workers = Num.parse(value);
  if (
    Option.isSome(workers) &&
    Number.isInteger(workers.value) &&
    workers.value > 0
  ) {
    return Num.min(workers.value, CORES);
  }
  throw new Error(
    `PLAYWRIGHT_WORKERS must be a whole number above 0; received "${value}".`
  );
}

// Each project as it runs. No project depends on another: Playwright skips a
// project whose dependency had one failure, and runs a dependency whole when
// one file is filtered, so suites order nothing and share nothing.
const PROJECTS = {
  "shared-runtime": {
    testIgnore: [
      ...CHAT_TESTS,
      ...LEARNER_TESTS,
      ...VISUAL_TESTS,
      ...TIMING_TESTS,
    ],
  },
  learner: {
    testIgnore: TIMING_TESTS,
    testMatch: LEARNER_TESTS,
  },
  chat: {
    testIgnore: TIMING_TESTS,
    testMatch: CHAT_TESTS,
  },
  visual: {
    testIgnore: TIMING_TESTS,
    testMatch: VISUAL_TESTS,
  },
  webkit: {
    testMatch: WEBKIT_TESTS,
    use: { browserName: "webkit" },
  },
  "school-firefox": {
    testIgnore: [
      ...CHROMIUM_SCHOOL_TESTS,
      ...BEHAVIOUR_SCHOOL_TESTS,
      ...TIMING_TESTS,
    ],
    testMatch: SCHOOL_TESTS,
    use: devices["Desktop Firefox"],
  },
  "school-safari": {
    testIgnore: [
      ...CHROMIUM_SCHOOL_TESTS,
      ...BEHAVIOUR_SCHOOL_TESTS,
      ...TIMING_TESTS,
    ],
    testMatch: SCHOOL_TESTS,
    use: devices["Desktop Safari"],
  },
  "school-android": {
    testIgnore: [...BEHAVIOUR_SCHOOL_TESTS, ...TIMING_TESTS],
    testMatch: SCHOOL_TESTS,
    use: devices["Pixel 7"],
  },
  "school-iphone": {
    testIgnore: [
      ...CHROMIUM_SCHOOL_TESTS,
      ...BEHAVIOUR_SCHOOL_TESTS,
      ...TIMING_TESTS,
    ],
    testMatch: SCHOOL_TESTS,
    use: devices["iPhone 15"],
  },
  timing: {
    testMatch: TIMING_TESTS,
    workers: 1,
  },
  "timing-webkit": {
    testMatch: WEBKIT_TIMING_TESTS,
    use: { browserName: "webkit" },
    workers: 1,
  },
  "school-timing-firefox": {
    testIgnore: CHROMIUM_SCHOOL_TESTS,
    testMatch: SCHOOL_TIMING_TESTS,
    use: devices["Desktop Firefox"],
    workers: 1,
  },
  "school-timing-safari": {
    testIgnore: CHROMIUM_SCHOOL_TESTS,
    testMatch: SCHOOL_TIMING_TESTS,
    use: devices["Desktop Safari"],
    workers: 1,
  },
  "school-timing-android": {
    testMatch: SCHOOL_TIMING_TESTS,
    use: devices["Pixel 7"],
    workers: 1,
  },
  "school-timing-iphone": {
    testIgnore: CHROMIUM_SCHOOL_TESTS,
    testMatch: SCHOOL_TIMING_TESTS,
    use: devices["iPhone 15"],
    workers: 1,
  },
} satisfies Record<string, Omit<Project, "dependencies" | "name">>;

type ProjectName = keyof typeof PROJECTS;

// Each suite is one run of `playwright test` against one prepared runtime,
// selected by PLAYWRIGHT_SUITE. A parallel suite runs its tests on
// `parallelWorkers`; a timing suite runs one test at a time, so a timing spec
// never shares the machine with another test. A whole run runs every parallel
// suite it needs, then the timing suites. Measured on 8 November on one worker:
// runtime 602 tests in 174 minutes, chat 200 tests in about 25.
const SUITES = {
  runtime: { projects: ["shared-runtime"], timing: false },
  learner: { projects: ["learner"], timing: false },
  chat: { projects: ["chat"], timing: false },
  visual: { projects: ["visual", "webkit"], timing: false },
  browsers: {
    projects: [
      "school-firefox",
      "school-safari",
      "school-android",
      "school-iphone",
    ],
    timing: false,
  },
  timing: { projects: ["timing", "timing-webkit"], timing: true },
  "browser-timing": {
    projects: [
      "school-timing-firefox",
      "school-timing-safari",
      "school-timing-android",
      "school-timing-iphone",
    ],
    timing: true,
  },
} satisfies Record<
  string,
  { readonly projects: readonly ProjectName[]; readonly timing: boolean }
>;

type SuiteName = keyof typeof SUITES;

function isSuiteName(value: string): value is SuiteName {
  return Arr.some(Rec.keys(SUITES), (name) => name === value);
}

/**
 * The projects and the worker count of the selected suite. Without a selection
 * every project runs at once on the parallel count, which suits a run of one
 * file or one folder: its timing specs then share the machine.
 */
function selectedRun(suite: string | undefined): {
  readonly projects: readonly ProjectName[];
  readonly workers: number;
} {
  const parallel = parallelWorkers(process.env.PLAYWRIGHT_WORKERS);
  if (suite === undefined) {
    return {
      projects: Arr.flatMap(Rec.values(SUITES), (one) => one.projects),
      workers: parallel,
    };
  }
  if (!isSuiteName(suite)) {
    throw new Error(
      `PLAYWRIGHT_SUITE must be one of ${Arr.join(Rec.keys(SUITES), ", ")}; received "${suite}".`
    );
  }
  const { projects, timing } = SUITES[suite];
  return { projects, workers: timing ? 1 : parallel };
}

const RUN = selectedRun(process.env.PLAYWRIGHT_SUITE);

/**
 * Whether each test records a trace and a video, which it keeps when it fails.
 * Recording costs every test CPU on a loaded machine, and a passing test throws
 * it away, so a run records only when PLAYWRIGHT_RECORD is 1, as a rerun of a
 * failure asks: `PLAYWRIGHT_RECORD=1 bunx playwright test <file>`.
 */
const RECORDING =
  process.env.PLAYWRIGHT_RECORD === "1" ? "retain-on-failure" : "off";

export default defineConfig({
  expect: {
    timeout: 5000,
  },
  fullyParallel: true,
  outputDir: "../../.cache/playwright/www",
  projects: Arr.map(
    RUN.projects,
    (name): Project => ({ name, ...PROJECTS[name] })
  ),
  reporter: "list",
  retries: 0,
  testDir: "./e2e",
  testMatch: "**/*.browser.ts",
  timeout: 120_000,
  use: {
    baseURL,
    screenshot: "only-on-failure",
    serviceWorkers: "block",
    trace: RECORDING,
    video: RECORDING,
  },
  workers: RUN.workers,
});
