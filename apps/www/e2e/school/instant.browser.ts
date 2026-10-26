import { expect, type Page, test } from "@playwright/test";
import { Array as Arr, Effect, MutableList } from "effect";
import { readCumulativeLayoutShift } from "@/e2e/support/layout";
import { recordServerFunctionCalls } from "@/e2e/support/requests";
import {
  createSchool,
  hostAddress,
  inviteLearner,
  seedSitting,
  signInOwner,
} from "@/e2e/support/school";

/** The sidebar of the school, whose links every click below starts from. */
const SIDEBAR = '[data-slot="sidebar-content"]';

/** The sidebar items of a manager's school, each by the address its link opens. */
const SIDEBAR_ITEMS = ["/", "/exams", "/settings/profile"];

test.use({ viewport: { width: 1440, height: 900 } });

/** The owner's bar for a School page: from the press to its first painted frame (26 Oct 2026). */
const COMMIT_BUDGET_MILLISECONDS = 200;

/** Every School page type that a manager opens, by its address on the school host. */
function managerPages(exam: string, sitting: string) {
  return [
    "/exams",
    `/exams/${exam}`,
    `/exams/${exam}/sittings/${sitting}`,
    `/exams/${exam}/sittings/${sitting}/results`,
    `/exams/${exam}/edit`,
    `/exams/${exam}/try`,
    "/settings/profile",
    "/settings/units",
    "/settings/periods",
    "/settings/cohorts",
    "/settings/members",
    "/settings/roles",
    "/settings/students",
    "/settings/invites",
    "/settings/audit",
    "/",
  ];
}

/**
 * How long one School page takes from the press to its first painted frame: the
 * app's own router moves to the address, as a link's press does, and the next
 * animation frame paints the page it committed.
 */
function commitTime(page: Page, href: string) {
  return page.evaluate(async (target) => {
    const router = window.__TSR_ROUTER__;
    if (router === undefined) {
      return Number.NaN;
    }
    const start = performance.now();
    await router.navigate({ href: target });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    return performance.now() - start;
  }, href);
}

/**
 * Opens each page in order and records its commit time. A page over the owner's
 * bar fails the test without stopping the pages after it.
 */
async function commitEach(page: Page, paths: readonly string[], who: string) {
  for (const path of paths) {
    const elapsed = await commitTime(page, path);
    test.info().annotations.push({
      description: `${who} ${path} ${Math.round(elapsed)} ms`,
      type: "commit",
    });
    expect
      .soft(elapsed, `${who} ${path}`)
      .toBeLessThan(COMMIT_BUDGET_MILLISECONDS);
  }
}

for (const viewport of [
  { height: 844, width: 390 },
  { height: 900, width: 1440 },
]) {
  test(`every School page type commits within the owner's bar and asks the Worker nothing, at ${viewport.width} px`, async ({
    browser,
    baseURL,
  }) => {
    const school = await Effect.runPromise(createSchool());
    const address = (path: string) =>
      hostAddress(baseURL, `${school.slug}.localhost`, path);
    const learner = `student-${school.slug}@acceptance.example.test`;
    const learnerContext = await browser.newContext({ viewport });
    await Effect.runPromise(
      inviteLearner({
        address: learner,
        baseURL: address("/"),
        context: learnerContext,
        slug: school.slug,
      })
    );
    const sitting = await Effect.runPromise(seedSitting(school.slug, learner));
    const ownerContext = await browser.newContext({ viewport });
    await Effect.runPromise(
      signInOwner(ownerContext, school.slug, address("/"))
    );

    const owner = await ownerContext.newPage();
    await owner.goto(address("/"));
    await owner.waitForLoadState("networkidle");
    const ownerCalls = recordServerFunctionCalls(owner);
    await commitEach(
      owner,
      managerPages(sitting.examId, sitting.sittingId),
      "owner"
    );

    const student = await learnerContext.newPage();
    await student.goto(address("/"));
    await student.waitForLoadState("networkidle");
    const studentCalls = recordServerFunctionCalls(student);
    await commitEach(
      student,
      [`/sittings/${sitting.sittingId}`, "/"],
      "student"
    );

    expect(
      Arr.appendAll(
        MutableList.toArray(ownerCalls),
        MutableList.toArray(studentCalls)
      )
    ).toEqual([]);
    await ownerContext.close();
    await learnerContext.close();
  });
}

test("every School sidebar item and every settings tab commits at once, and nothing moves after the click", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const schoolHome = hostAddress(baseURL, `${school.slug}.localhost`, "/");
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, schoolHome));
  const page = await context.newPage();
  await page.goto(schoolHome);
  const sidebar = page.locator(SIDEBAR);
  await expect(sidebar.locator('a[href="/exams"]')).toBeVisible();

  for (const item of SIDEBAR_ITEMS) {
    await sidebar.locator(`a[href="${item}"]`).click();
    await page.waitForURL((url) => url.pathname === item);
    await page.waitForLoadState("networkidle");
    expect(await Effect.runPromise(readCumulativeLayoutShift(page))).toBe(0);
  }

  // The settings page replaces the sidebar's groups with the settings sections.
  await sidebar.locator('a[href="/settings/profile"]').click();
  await page.waitForURL((url) => url.pathname === "/settings/profile");
  const tabs = await sidebar
    .locator('a[href^="/settings/"]')
    .evaluateAll((links) =>
      links.map((link) => link.getAttribute("href") ?? "")
    );
  expect(tabs.length).toBeGreaterThan(1);

  for (const tab of tabs) {
    await sidebar.locator(`a[href="${tab}"]`).click();
    await page.waitForURL((url) => url.pathname === tab);
    await page.waitForLoadState("networkidle");
    expect(await Effect.runPromise(readCumulativeLayoutShift(page))).toBe(0);
  }

  await context.close();
});

test("a click between School pages asks the Worker nothing: each page reads its rows live", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();
  await page.goto(address("/settings/profile"));
  const sidebar = page.locator(SIDEBAR);
  await expect(sidebar.locator('a[href="/settings/units"]')).toBeVisible();
  await page.waitForLoadState("networkidle");
  const calls = recordServerFunctionCalls(page);

  for (const path of ["/settings/units", "/settings/periods", "/", "/exams"]) {
    const link = sidebar.locator(`a[href="${path}"]`);
    if (path === "/") {
      // Home sits in the school's own sidebar, which the settings replace.
      await page.locator('[data-slot="page-header"] a[href="/"]').click();
    } else if (path === "/exams") {
      await sidebar.locator('a[href="/exams"]').click();
    } else {
      await link.click();
    }
    await page.waitForURL((url) => url.pathname === path);
  }
  await page.waitForLoadState("networkidle");

  expect(MutableList.toArray(calls)).toEqual([]);
  await context.close();
});
