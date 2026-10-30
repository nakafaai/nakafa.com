import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { readRepeatedIcons } from "@/e2e/support/icons";
import { readCumulativeLayoutShift } from "@/e2e/support/layout";
import {
  createSchool,
  hostAddress,
  inviteLearner,
  seedSitting,
  signInClassTeacher,
  signInOwner,
  signInTeacher,
} from "@/e2e/support/school";

/** The exam title and the room that the acceptance runtime seeds for a sitting that is open now. */
const SEEDED_EXAM = "Ujian Acceptance";
const SEEDED_ROOM = /Lab 2/u;

/** The accessible name of the upcoming room's bar in the owner's schedule: its exam, then its room. */
const UPCOMING_BAR = /Ujian Acceptance, Lab 3/u;

/** The one sentence of the quiet state of a staff home, while no room runs and none opens soon. */
const QUIET_STAFF =
  "No sitting is running, and none opens in the next 14 days.";

/** The one sentence of the quiet state of a student's home, while the teacher has scheduled no sitting. */
const QUIET_STUDENT = "Your teacher has not scheduled a sitting yet.";

/** The address of the setup row that invites a teacher: the school path, which the school host shows as the settings page. */
const SETUP_INVITES_HREF = /\/settings\/invites$/u;

/** The addresses of the home's shortcuts to the exams, the members and the settings. */
const EXAMS_HREF = /\/exams$/u;
const MEMBERS_HREF = /\/settings\/members$/u;
const SETTINGS_HREF = /\/settings\/profile$/u;

/** The shortcuts' accessible names, each the part's name and then its one sentence. */
const EXAMS_LINK = /^Exams/u;
const MEMBERS_LINK = /^Members/u;
const SETTINGS_LINK = /^Settings/u;

/** The address of the class that the acceptance runtime seeds for a class teacher. */
const CLASS_HREF = /\/classes\/fisika-x-1$/u;

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

  // The greeting is the heading of the one header row, and the action sits in that row at its end.
  const header = page.locator('[data-slot="page-header"]');
  await expect(header.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(
    header.getByRole("button", { name: "Create exam" })
  ).toBeVisible();
  await expect(page.getByText(QUIET_STAFF, { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Now", exact: true })
  ).toHaveCount(0);
  // A new school has no teacher, so the owner's setup links the step that completes it.
  await expect(page.getByText("Setup", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Invite a teacher" })
  ).toHaveAttribute("href", SETUP_INVITES_HREF);
  // A setup row has no other text, so its arrow shows without a hover.
  // The row's only icon is its arrow at its end.
  await expect(
    page.getByRole("link", { name: "Invite a teacher" }).locator("svg").last()
  ).toHaveCSS("opacity", "1");
  await context.close();
});

test("the owner's Beranda is a plain greeting over separate cards, each titled in plain words", async ({
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

  // The header row holds the greeting and the action, with no picture beside the greeting: every icon in it is the
  // size of an icon.
  const header = page.locator('[data-slot="page-header"]');
  const widths = await header
    .locator("svg")
    .evaluateAll((icons) =>
      icons.map((icon) => icon.getBoundingClientRect().width)
    );
  expect(Math.max(...widths)).toBeLessThanOrEqual(24);

  // Each concern is a card of its own, with the page's gap between cards.
  const cards = page.locator('[data-slot="dashboard-cell"]');
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeGreaterThan(1);
  await expect(cards.first()).not.toHaveCSS("border-radius", "0px");
  await expect(page.locator('[data-slot="dashboard"]')).toHaveCSS(
    "row-gap",
    "16px"
  );

  // The shortcuts above the cards open the parts of the school the owner may open, each with an icon of its own, and
  // no card counts rooms in a number.
  const shortcuts = page.getByRole("navigation", { name: "Shortcuts" });
  await expect(
    shortcuts.getByRole("link", { name: EXAMS_LINK })
  ).toHaveAttribute("href", EXAMS_HREF);
  await expect(
    shortcuts.getByRole("link", { name: MEMBERS_LINK })
  ).toHaveAttribute("href", MEMBERS_HREF);
  await expect(
    shortcuts.getByRole("link", { name: SETTINGS_LINK })
  ).toHaveAttribute("href", SETTINGS_HREF);
  expect(await readRepeatedIcons(shortcuts, "a")).toEqual([]);
  await expect(cards.filter({ hasText: "Rooms running" })).toHaveCount(0);
  // The quiet state is the schedule's card, titled as the schedule is.
  await expect(
    cards.filter({ hasText: QUIET_STAFF }).getByRole("heading", {
      name: "Schedule",
    })
  ).toBeVisible();
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

test("a class teacher's Beranda lists the teacher's class, and its row opens the class", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext();
  await Effect.runPromise(
    signInClassTeacher(context, school.slug, address("/"))
  );
  const page = await context.newPage();

  await page.goto(address("/"));

  const classes = page
    .locator('[data-slot="dashboard-cell"]')
    .filter({ has: page.getByRole("heading", { name: "Classes" }) });
  await expect(
    classes.getByRole("link", { name: "Fisika X-1" })
  ).toHaveAttribute("href", CLASS_HREF);
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

  await expect(
    page.getByRole("heading", { name: "Now", exact: true })
  ).toBeVisible();
  // The one action of a student's page is Start exam, while the seeded sitting is open.
  await expect(
    page.getByRole("link", { name: "Start exam", exact: true })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Create exam" })).toHaveCount(
    0
  );
  await expect(page.getByText("Live now", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Shortcuts" })).toHaveCount(
    0
  );
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
  await expect(
    page.getByRole("link", { name: "Start exam", exact: true })
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Create exam" })).toHaveCount(
    0
  );
  await expect(
    page.getByRole("heading", { name: "Now", exact: true })
  ).toHaveCount(0);
  await context.close();
});

test("a sitting that runs now appears in the owner's Live now cell, and its row opens the proctor's room", async ({
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

  // The seeded exam is also a draft of its author, so its title shows in the drafts cell too. The
  // live row is the one that names the room, and it opens the room.
  const row = page.getByRole("link", { name: SEEDED_ROOM }).first();
  await expect(row).toContainText(SEEDED_EXAM);
  await expect(row).toHaveAttribute(
    "href",
    new RegExp(`/exams/${sitting.examId}/sittings/${sitting.sittingId}$`, "u")
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

test("Beranda shows its greeting and each row's title whole from a 320 px phone to a tablet, wrapping instead of clipping", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const learner = `home-wrap-${school.slug}@acceptance.example.test`;
  const learnerContext = await browser.newContext();
  await Effect.runPromise(
    inviteLearner({
      address: learner,
      baseURL: address("/"),
      context: learnerContext,
      slug: school.slug,
    })
  );
  const context = await browser.newContext({
    viewport: { height: 640, width: 320 },
  });
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  await Effect.runPromise(seedSitting(school.slug, learner));
  const page = await context.newPage();

  await page.goto(address("/"));

  // The greeting, and the seeded exam's title in the live and drafts rows beside their times: a text that a box clips
  // is wider inside than the box shows.
  const greeting = page
    .locator('[data-slot="page-header"]')
    .getByRole("heading", { level: 1 });
  const titles = page.getByText(SEEDED_EXAM, { exact: true });
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ height: 900, width });
    await expect(greeting).toBeVisible();
    await expect(titles).toHaveCount(2);
    const clipped = [
      ...(await greeting.evaluateAll((elements) =>
        elements.map((element) => element.scrollWidth > element.clientWidth)
      )),
      ...(await titles.evaluateAll((elements) =>
        elements.map((element) => element.scrollWidth > element.clientWidth)
      )),
    ];
    expect(clipped).not.toContain(true);
  }
  await context.close();
  await learnerContext.close();
});

test("Beranda takes the app's page width on a wide screen, centred beside the sidebar", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext({
    viewport: { height: 1080, width: 1920 },
  });
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();

  await page.goto(address("/"));
  await expect(page.getByText(QUIET_STAFF, { exact: true })).toBeVisible();

  // Every app page keeps max-w-7xl (80rem, 1280 px), and the page's side padding sits inside it.
  const content = await page.locator("article").first().boundingBox();
  expect(content?.width).toBe(1280);
  await context.close();
});

test("an upcoming room shows as a bar in the owner's schedule, and the bar opens its room", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const learner = `home-upcoming-${school.slug}@acceptance.example.test`;
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
  const sitting = await Effect.runPromise(
    seedSitting(school.slug, learner, 0, "upcoming")
  );
  const page = await context.newPage();

  await page.goto(address("/"));

  // The seed's upcoming room is a second room of the exam, so the bar must open a room of that exam.
  const bar = page.getByRole("link", { name: UPCOMING_BAR });
  await expect(bar).toHaveAttribute(
    "href",
    new RegExp(`/exams/${sitting.examId}/sittings/[^/]+$`, "u")
  );
  await context.close();
  await learnerContext.close();
});
