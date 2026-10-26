import { defineConfig, type Project } from "@playwright/test";
import { acceptanceOrigin } from "@repo/backend/scripts/content/acceptance/origin";
import { Array as Arr, Effect, Record as Rec } from "effect";

// The browser tests open the acceptance runtime's origin, localhost on the port
// that ACCEPTANCE_PORT names (3000 by default), so set the same ACCEPTANCE_PORT
// that prepared the runtime. A developer server under Portless takes its URL
// from PLAYWRIGHT_BASE_URL, for example `bunx portless get nakafa`.
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? Effect.runSync(acceptanceOrigin);

// Projects select files by folder path, so a file that repeats a basename
// never joins a project by accident.
// Each suite pays about ten minutes to prepare and build before its first
// test, so the suites are balanced by run time. Measured on 12 October: runtime
// 290 s plus 40 s of site checks, learner 316 s, chat 361 s, visual 349 s,
// navigation 267 to 344 s. Marketing and consent run in the visual suite only
// for that balance.
const VISUAL_TESTS = [
  "**/visual/**/*.browser.ts",
  "**/scene/**/*.browser.ts",
  "**/marketing/**/*.browser.ts",
  "**/consent/**/*.browser.ts",
  "**/content/charts.browser.ts",
];

// The account, settings and try-out pages are the slowest files of the shared
// runtime (316 of its 604 s), and no test of a public page reads what they
// write, so they run in their own leg.
const LEARNER_TESTS = [
  "**/account/**/*.browser.ts",
  "**/settings/**/*.browser.ts",
  "**/tryout/**/*.browser.ts",
];

// Nina's chats, on their page and in the sheet. They seed their own chats and
// take as long as the whole learner suite, so they run in their own leg too.
const CHAT_TESTS = ["**/chat/**/*.browser.ts", "**/nina/**/*.browser.ts"];

// Each project as it runs. No project names its dependency here: the suite
// order below derives it.
const PROJECTS = {
  "shared-runtime": {
    testIgnore: [
      "**/navigation/instant.browser.ts",
      ...CHAT_TESTS,
      ...LEARNER_TESTS,
      ...VISUAL_TESTS,
    ],
    workers: 1,
  },
  learner: {
    testMatch: LEARNER_TESTS,
    workers: 1,
  },
  chat: {
    testMatch: CHAT_TESTS,
    workers: 1,
  },
  visual: {
    testMatch: VISUAL_TESTS,
    workers: 1,
  },
  "isolated-navigation": {
    testMatch: "**/navigation/instant.browser.ts",
    workers: 2,
  },
  // Visual cards take the whole screen through the Fullscreen API on
  // desktop, Android, and iPad, and cover the viewport on iPhone, so their
  // suite also runs in WebKit. Its project runs after the navigation checks,
  // so no other browser shares the runner while those checks measure timing.
  webkit: {
    testMatch: "**/visual/cards.browser.ts",
    use: { browserName: "webkit" },
    workers: 1,
  },
} satisfies Record<string, Omit<Project, "dependencies" | "name">>;

type ProjectName = keyof typeof PROJECTS;

// Each suite runs in its own runtime. Projects in a suite run in
// the listed order, and each one waits for the project before it. Without a
// selection, every suite runs as one chain in this order.
const SUITES = {
  runtime: ["shared-runtime"],
  learner: ["learner"],
  chat: ["chat"],
  visual: ["visual"],
  navigation: ["isolated-navigation", "webkit"],
} satisfies Record<string, readonly ProjectName[]>;

type SuiteName = keyof typeof SUITES;

function isSuiteName(value: string): value is SuiteName {
  return Arr.some(Rec.keys(SUITES), (name) => name === value);
}

/** Returns the project names of the selected suite, or of every suite in order. */
function selectedProjectNames(
  suite: string | undefined
): readonly ProjectName[] {
  if (suite === undefined) {
    return Arr.flatten(Rec.values(SUITES));
  }
  if (!isSuiteName(suite)) {
    throw new Error(
      `PLAYWRIGHT_SUITE must be one of ${Arr.join(Rec.keys(SUITES), ", ")}; received "${suite}".`
    );
  }
  return SUITES[suite];
}

/** Builds the projects in order: each one depends on the project before it. */
function chainProjects(names: readonly ProjectName[]): Project[] {
  return Arr.map(names, (name, index) => ({
    name,
    ...PROJECTS[name],
    dependencies: Arr.fromOption(Arr.get(names, index - 1)),
  }));
}

export default defineConfig({
  expect: {
    timeout: 5000,
  },
  fullyParallel: false,
  outputDir: "../../.cache/playwright/www",
  projects: chainProjects(selectedProjectNames(process.env.PLAYWRIGHT_SUITE)),
  reporter: "list",
  retries: 0,
  testDir: "./e2e",
  testMatch: "**/*.browser.ts",
  timeout: 120_000,
  use: {
    baseURL,
    screenshot: "only-on-failure",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
});
