import { defineConfig, type Project } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

// Projects select files by folder path, so a file that repeats a basename
// never joins a project by accident.
const VISUAL_TESTS = [
  "**/visual/**/*.browser.ts",
  "**/scene/**/*.browser.ts",
  "**/marketing/**/*.browser.ts",
  "**/consent/**/*.browser.ts",
  "**/content/charts.browser.ts",
];

// Each project as it runs. No project names its dependency here: the suite
// order below derives it.
const PROJECTS = {
  // The hydration checks need pages that still stream on demand, so they run
  // first in the runtime suite, before any other test caches those pages. Each
  // CI job starts its own runtime, so no other suite caches them first.
  "cold-runtime": {
    testMatch: "**/content/hydration.browser.ts",
    workers: 1,
  },
  "shared-runtime": {
    testIgnore: [
      "**/content/hydration.browser.ts",
      "**/navigation/instant.browser.ts",
      ...VISUAL_TESTS,
    ],
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

// Each CI job runs one suite in its own runtime. Projects in a suite run in
// the listed order, and each one waits for the project before it. Without a
// selection, every suite runs as one chain in this order.
const SUITES = {
  runtime: ["cold-runtime", "shared-runtime"],
  visual: ["visual"],
  navigation: ["isolated-navigation", "webkit"],
} satisfies Record<string, readonly ProjectName[]>;

type SuiteName = keyof typeof SUITES;

function isSuiteName(value: string): value is SuiteName {
  return Object.hasOwn(SUITES, value);
}

/** Returns the project names of the selected suite, or of every suite in order. */
function selectedProjectNames(
  suite: string | undefined
): readonly ProjectName[] {
  if (suite === undefined) {
    return Object.values(SUITES).flat();
  }
  if (!isSuiteName(suite)) {
    throw new Error(
      `PLAYWRIGHT_SUITE must be one of ${Object.keys(SUITES).join(", ")}; received "${suite}".`
    );
  }
  return SUITES[suite];
}

/** Builds the projects in order, each one depending on the project before it. */
function chainProjects(names: readonly ProjectName[]): Project[] {
  const projects: Project[] = [];
  for (const name of names) {
    const previous = projects.at(-1)?.name;
    projects.push({
      name,
      ...PROJECTS[name],
      ...(previous === undefined ? {} : { dependencies: [previous] }),
    });
  }
  return projects;
}

export default defineConfig({
  expect: {
    timeout: 5000,
  },
  failOnFlakyTests: Boolean(process.env.CI),
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: false,
  outputDir: "../../.cache/playwright/www",
  projects: chainProjects(selectedProjectNames(process.env.PLAYWRIGHT_SUITE)),
  reporter: "list",
  retries: process.env.CI ? 1 : 0,
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
  ...(process.env.CI ? { workers: 2 } : {}),
});
