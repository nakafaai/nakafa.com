import { type BrowserContext, expect, test } from "@playwright/test";
import { Effect, MutableList } from "effect";
import {
  expectNoOverflow,
  readCumulativeLayoutShift,
} from "@/e2e/support/layout";
import {
  createSchool,
  grantStudent,
  hostAddress,
  inviteLearner,
  signInOwner,
  signInTeacher,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** What a School page draws once it has read its data: an empty state, a table, or a card. */
const DRAWN =
  '[data-slot="empty"], [data-slot="table"], main [data-slot="card"]';

/** Every page an Owner opens in a school that holds nothing yet but the Owner. */
const OWNER_PAGES = [
  "/exams",
  "/reports",
  "/notifications",
  "/settings/profile",
  "/settings/units",
  "/settings/periods",
  "/settings/cohorts",
  "/settings/classes",
  "/settings/grading",
  "/settings/roles",
  "/settings/students",
  "/settings/members",
  "/settings/invites",
  "/settings/clients",
  "/settings/policies",
  "/settings/audit",
  "/settings/roster",
  "/settings/guardians",
  "/settings/connections",
  "/settings/billing",
];

/** Every page a Teacher of an empty school opens. */
const TEACHER_PAGES = ["/exams", "/notifications"];

/** Every page a Student of an empty school opens. */
const STUDENT_PAGES = ["/sittings", "/notifications"];

/**
 * Opens each page in turn at one width, and asserts that it draws what it read, never a failure, a
 * not-found page, an error in the page, a sideways scroll or a layout shift.
 */
async function expectEmptyPages(
  context: BrowserContext,
  address: (path: string) => string,
  role: string,
  pages: readonly string[]
) {
  const page = await context.newPage();
  const errors = MutableList.make<string>();
  page.on("pageerror", (error) => {
    MutableList.append(errors, `${page.url()}: ${error.message}`);
  });
  for (const viewport of [
    { height: 844, width: 390 },
    { height: 900, width: 1440 },
  ]) {
    await page.setViewportSize(viewport);
    for (const path of pages) {
      const label = `${role} ${viewport.width} ${path}`;
      await page.goto(address(path));
      await expect(
        page.locator('[data-slot="page-header"]'),
        label
      ).toBeVisible();
      await expect(page.locator(DRAWN).first(), label).toBeVisible({
        timeout: readinessTimeoutMilliseconds,
      });
      await expect(
        page.getByText("We could not load this data."),
        label
      ).toHaveCount(0);
      await expect(
        page.getByText("We can't find this page"),
        label
      ).toHaveCount(0);
      await Effect.runPromise(expectNoOverflow(page, label));
      await page.waitForLoadState("load");
      expect(
        await Effect.runPromise(readCumulativeLayoutShift(page)),
        label
      ).toBe(0);
    }
  }
  expect(MutableList.toArray(errors)).toEqual([]);
  await page.close();
}

test("a school that holds nothing yet draws every page of the Owner, a Teacher and a Student as its empty state, with no error and no shift", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(420_000);
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);

  const owner = await browser.newContext();
  await Effect.runPromise(signInOwner(owner, school.slug, address("/")));
  await expectEmptyPages(owner, address, "owner", OWNER_PAGES);
  await owner.close();

  const teacher = await browser.newContext();
  await Effect.runPromise(signInTeacher(teacher, school.slug, address("/")));
  await expectEmptyPages(teacher, address, "teacher", TEACHER_PAGES);
  await teacher.close();

  const learnerAddress = `student-${school.slug}@acceptance.example.test`;
  const student = await browser.newContext();
  await Effect.runPromise(
    inviteLearner({
      address: learnerAddress,
      baseURL: address("/"),
      context: student,
      slug: school.slug,
    })
  );
  await Effect.runPromise(grantStudent(school.slug, learnerAddress));
  await expectEmptyPages(student, address, "student", STUDENT_PAGES);
  await student.close();
});
