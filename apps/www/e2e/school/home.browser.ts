import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { readCumulativeLayoutShift } from "@/e2e/support/layout";
import {
  createSchool,
  hostAddress,
  inviteLearner,
  seedSitting,
  signInOwner,
  signInTeacher,
} from "@/e2e/support/school";

/** The exam title and the room that the acceptance runtime seeds for a sitting that is open now. */
const SEEDED_EXAM = "Ujian Acceptance";
const SEEDED_ROOM = /Lab 2/u;

test("the owner's Beranda shows the page's one action and the tiles of a proctor", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();

  await page.goto(address("/"));

  await expect(page.getByRole("button", { name: "Create exam" })).toBeVisible();
  await expect(page.getByText("In progress", { exact: true })).toBeVisible();
  await expect(page.getByText("Up next", { exact: true })).toBeVisible();
  await expect(page.getByText("Keep writing", { exact: true })).toBeVisible();
  await expect(page.getByText("Your sittings", { exact: true })).toHaveCount(0);
  await context.close();
});

test("a teacher's Beranda shows the teacher's tiles and the same one action", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext();
  await Effect.runPromise(signInTeacher(context, school.slug, address("/")));
  const page = await context.newPage();

  await page.goto(address("/"));

  await expect(page.getByRole("button", { name: "Create exam" })).toBeVisible();
  await expect(page.getByText("Keep writing", { exact: true })).toBeVisible();
  await expect(page.getByText("In progress", { exact: true })).toBeVisible();
  await context.close();
});

test("a student's Beranda shows the student's sittings and no action of the page", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const learner = `home-${school.slug}@acceptance.example.test`;
  const context = await browser.newContext();
  await Effect.runPromise(
    inviteLearner({
      address: learner,
      baseURL: address("/"),
      context,
      slug: school.slug,
    })
  );
  await Effect.runPromise(seedSitting(school.slug, learner));
  const page = await context.newPage();

  await page.goto(address("/"));

  await expect(page.getByText("Your sittings", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create exam" })).toHaveCount(
    0
  );
  await expect(page.getByText("In progress", { exact: true })).toHaveCount(0);
  await context.close();
});

test("a sitting that runs now appears in the owner's In progress tile, and its row opens the proctor's room", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const learner = `home-live-${school.slug}@acceptance.example.test`;
  const learnerContext = await browser.newContext();
  await Effect.runPromise(
    inviteLearner({
      address: learner,
      baseURL: address("/"),
      context: learnerContext,
      slug: school.slug,
    })
  );
  const sitting = await Effect.runPromise(seedSitting(school.slug, learner));
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();

  await page.goto(address("/"));

  await expect(page.getByText(SEEDED_EXAM, { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: SEEDED_ROOM }).first()
  ).toHaveAttribute(
    "href",
    `/exams/${sitting.examId}/sittings/${sitting.sittingId}`
  );
  await context.close();
  await learnerContext.close();
});

test("Beranda keeps its tiles in place while their rows load", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();

  await page.goto(address("/"));
  await expect(page.getByText("Keep writing", { exact: true })).toBeVisible();
  await page.waitForLoadState("load");

  expect(await Effect.runPromise(readCumulativeLayoutShift(page))).toBe(0);
  await context.close();
});

test("Beranda keeps its tiles in place on a phone while their rows load", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext({
    viewport: { height: 844, width: 390 },
  });
  await Effect.runPromise(signInTeacher(context, school.slug, address("/")));
  const page = await context.newPage();

  await page.goto(address("/"));
  await expect(page.getByText("Keep writing", { exact: true })).toBeVisible();
  await page.waitForLoadState("load");

  expect(await Effect.runPromise(readCumulativeLayoutShift(page))).toBe(0);
  await context.close();
});

test("Beranda fits a 320 px phone without a sideways scroll", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext({
    viewport: { height: 640, width: 320 },
  });
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();

  await page.goto(address("/"));
  await expect(page.getByText("Keep writing", { exact: true })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await context.close();
});
