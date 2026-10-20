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

/** The one sentence of the quiet state of a staff home, while no room runs and none opens soon. */
const QUIET_STAFF =
  "No sitting is running, and none opens in the next 14 days.";

/** The one sentence of the quiet state of a student's home, while the teacher has scheduled no sitting. */
const QUIET_STUDENT = "Your teacher has not scheduled a sitting yet.";

test("the owner's Beranda shows the page's one action, the quiet state, and the setup", async ({
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
  await expect(page.getByText(QUIET_STAFF, { exact: true })).toBeVisible();
  await expect(page.getByText("In progress", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Your sittings", { exact: true })).toHaveCount(0);
  // A new school has no teacher, so the owner's setup links the step that completes it.
  await expect(page.getByText("Setup", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Invite a teacher" })
  ).toHaveAttribute("href", "/settings/invites");
  // A setup row has no other text, so its arrow shows without a hover.
  await expect(
    page.getByRole("link", { name: "Invite a teacher" }).locator("svg")
  ).toHaveCSS("opacity", "1");
  await context.close();
});

test("a teacher's Beranda shows the same one action and no setup", async ({
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
  await expect(page.getByText(QUIET_STAFF, { exact: true })).toBeVisible();
  await expect(page.getByText("Setup", { exact: true })).toHaveCount(0);
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
  // The seed records its exam as made by the school's Owner, who must have signed in first.
  const ownerContext = await browser.newContext();
  await Effect.runPromise(signInOwner(ownerContext, school.slug, address("/")));
  await Effect.runPromise(seedSitting(school.slug, learner));
  await ownerContext.close();
  const page = await context.newPage();

  await page.goto(address("/"));

  await expect(page.getByText("Your sittings", { exact: true })).toBeVisible();
  // The one action of a student's page is Enter sitting, while the seeded sitting is open.
  await expect(page.getByRole("link", { name: "Enter sitting" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create exam" })).toHaveCount(
    0
  );
  await expect(page.getByText("In progress", { exact: true })).toHaveCount(0);
  await context.close();
});

test("a student with no sitting sees the quiet state and no action", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const learner = `home-quiet-${school.slug}@acceptance.example.test`;
  const context = await browser.newContext();
  await Effect.runPromise(
    inviteLearner({
      address: learner,
      baseURL: address("/"),
      context,
      slug: school.slug,
    })
  );
  const page = await context.newPage();

  await page.goto(address("/"));

  await expect(page.getByText(QUIET_STUDENT, { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Enter sitting" })).toHaveCount(
    0
  );
  await expect(page.getByRole("button", { name: "Create exam" })).toHaveCount(
    0
  );
  await expect(page.getByText("Your sittings", { exact: true })).toHaveCount(0);
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
  const context = await browser.newContext();
  // The seed records its exam as made by the school's Owner, who must have signed in first.
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const sitting = await Effect.runPromise(seedSitting(school.slug, learner));
  const page = await context.newPage();

  await page.goto(address("/"));

  // The seeded exam is also a draft of its author, so its title shows in the drafts tile too. The
  // In progress row is the one that names the room, and it opens the room.
  const row = page.getByRole("link", { name: SEEDED_ROOM }).first();
  await expect(row).toContainText(SEEDED_EXAM);
  await expect(row).toHaveAttribute(
    "href",
    `/exams/${sitting.examId}/sittings/${sitting.sittingId}`
  );
  await context.close();
  await learnerContext.close();
});

test("Beranda keeps its place while its rows load", async ({
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
  await expect(page.getByText(QUIET_STAFF, { exact: true })).toBeVisible();
  await page.waitForLoadState("load");

  expect(await Effect.runPromise(readCumulativeLayoutShift(page))).toBe(0);
  await context.close();
});

test("Beranda keeps its place on a phone while its rows load", async ({
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
  await expect(page.getByText(QUIET_STAFF, { exact: true })).toBeVisible();
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
  await expect(page.getByText(QUIET_STAFF, { exact: true })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await context.close();
});
