import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
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

/** The room of the second sitting that the seed schedules for the next day. */
const UPCOMING_ROOM = /Lab 3/u;

/** The address of the setup row that invites a teacher: the school path, which the school host shows as the settings page. */
const SETUP_INVITES_HREF = /\/settings\/invites$/u;

/** The address of every update of the school. */
const UPDATES_HREF = /\/notifications$/u;

/** The address of the class that the acceptance runtime seeds for a class teacher. */
const CLASS_HREF = /\/classes\/fisika-x-1$/u;

/** The section heading that every home ends with, so a test knows the home has drawn. */
const UPDATES = "Updates";

/** A section of the home, found by its heading. */
const section = (page: Page, name: string) =>
  page.getByRole("region", { name, exact: true });

/** Waits until the home has drawn its sections, which appear at once. */
const homeDrawn = (page: Page) => expect(section(page, UPDATES)).toBeVisible();

test("the owner's home is a greeting with no page action, then the setup and the updates under their headings", async ({
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
  await homeDrawn(page);

  // The greeting is the heading of the one header row, which holds no page action.
  const header = page.locator('[data-slot="page-header"]');
  await expect(header.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(header.getByRole("button", { name: "Create exam" })).toHaveCount(
    0
  );
  // A new school has no teacher, so the owner's setup links the step that completes it.
  await expect(
    section(page, "Set up the school").getByRole("link", {
      name: "Invite a teacher",
    })
  ).toHaveAttribute("href", SETUP_INVITES_HREF);
  // Nothing happened in the school yet, and the updates say so and link to every update.
  const updates = section(page, UPDATES);
  await expect(updates.getByText("Nothing new yet.")).toBeVisible();
  await expect(
    updates.getByRole("link", { name: "All updates" })
  ).toHaveAttribute("href", UPDATES_HREF);
  // An owner with no room and no class gets no empty section for them.
  await expect(section(page, "Rooms")).toHaveCount(0);
  await expect(section(page, "Classes")).toHaveCount(0);
  await context.close();
});

test("no card of the home draws a rule inside it", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const learner = `home-rules-${school.slug}@acceptance.example.test`;
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
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  await Effect.runPromise(seedSitting(school.slug, learner, 0, "upcoming"));
  const page = await context.newPage();

  await page.goto(address("/"));
  await homeDrawn(page);
  await expect(section(page, "Rooms")).toBeVisible();

  // A rule is a visible top or bottom border on anything inside a card.
  const rules = await page.locator('main [data-slot="card"] *').evaluateAll(
    (elements) =>
      elements.filter((element) => {
        const style = getComputedStyle(element);
        const drawn = (width: string, color: string) =>
          Number.parseFloat(width) > 0 &&
          color !== "transparent" &&
          !color.endsWith(", 0)");
        return (
          drawn(style.borderTopWidth, style.borderTopColor) ||
          drawn(style.borderBottomWidth, style.borderBottomColor)
        );
      }).length
  );
  expect(rules).toBe(0);
  await context.close();
  await learnerContext.close();
});

test("a teacher's home has no setup and no page action", async ({
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
  await homeDrawn(page);

  await expect(page.getByRole("button", { name: "Create exam" })).toHaveCount(
    0
  );
  await expect(section(page, "Set up the school")).toHaveCount(0);
  await context.close();
});

test("a class teacher's home shows the teacher's class as a tile that opens the class", async ({
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
  await homeDrawn(page);

  await expect(
    section(page, "Classes").getByRole("link", { name: "Fisika X-1" })
  ).toHaveAttribute("href", CLASS_HREF);
  await context.close();
});

test("a student's home lists the open exam with its Start, and no page action", async ({
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
  const sitting = await Effect.runPromise(seedSitting(school.slug, learner));
  await ownerContext.close();
  const page = await context.newPage();

  await page.goto(address("/"));
  await homeDrawn(page);

  // The open exam's Start enters the sitting, in the body beside the exam it starts.
  const exams = section(page, "Exams");
  await expect(exams.getByText(SEEDED_EXAM, { exact: true })).toBeVisible();
  await expect(
    exams.getByRole("link", { name: "Start exam", exact: true })
  ).toHaveAttribute("href", new RegExp(`/sittings/${sitting.sittingId}$`, "u"));
  await expect(
    page
      .locator('[data-slot="page-header"]')
      .getByRole("link", { name: "Start exam" })
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Create exam" })).toHaveCount(
    0
  );
  await context.close();
});

test("a student with no exam and no class reads one sentence for the classes, and no exams section", async ({
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
  await homeDrawn(page);

  await expect(
    section(page, "Classes").getByText("You are not in a class yet.")
  ).toBeVisible();
  await expect(section(page, "Exams")).toHaveCount(0);
  await context.close();
});

test("a room that runs now and one that opens tomorrow show in the owner's rooms, each opening its room", async ({
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
  const sitting = await Effect.runPromise(
    seedSitting(school.slug, learner, 0, "upcoming")
  );
  const page = await context.newPage();

  await page.goto(address("/"));
  await homeDrawn(page);

  const rooms = section(page, "Rooms");
  const live = rooms.getByRole("link", { name: SEEDED_ROOM });
  await expect(live).toContainText(SEEDED_EXAM);
  await expect(live).toContainText("minutes left");
  await expect(live).toHaveAttribute(
    "href",
    new RegExp(`/exams/${sitting.examId}/sittings/${sitting.sittingId}$`, "u")
  );
  // The seed's upcoming room is a second room of the exam, so its row opens a room of that exam.
  await expect(
    rooms.getByRole("link", { name: UPCOMING_ROOM })
  ).toHaveAttribute(
    "href",
    new RegExp(`/exams/${sitting.examId}/sittings/[^/]+$`, "u")
  );
  await context.close();
  await learnerContext.close();
});

test("the home keeps its place while its sections load", async ({
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
  await homeDrawn(page);
  await page.waitForLoadState("load");

  expect(await Effect.runPromise(readCumulativeLayoutShift(page))).toBe(0);
  await context.close();
});

test("the home keeps its place on a phone while its sections load", async ({
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
  await homeDrawn(page);
  await page.waitForLoadState("load");

  expect(await Effect.runPromise(readCumulativeLayoutShift(page))).toBe(0);
  await context.close();
});

test("the home shows its greeting and every row's title whole from a 320 px phone to a desktop, with no sideways scroll", async ({
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
  await Effect.runPromise(seedSitting(school.slug, learner, 0, "upcoming"));
  const page = await context.newPage();

  await page.goto(address("/"));
  await homeDrawn(page);

  // The greeting, and the seeded exam's title in both rooms beside their times: a text that a box clips is wider
  // inside than the box shows.
  const greeting = page
    .locator('[data-slot="page-header"]')
    .getByRole("heading", { level: 1 });
  const titles = section(page, "Rooms").getByText(SEEDED_EXAM, {
    exact: true,
  });
  for (const width of [320, 390, 768, 1440]) {
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
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  }
  await context.close();
  await learnerContext.close();
});

test("the home takes the app's page width on a wide screen, centred beside the sidebar", async ({
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
  await homeDrawn(page);

  // Every app page keeps max-w-7xl (80rem, 1280 px), and the page's side padding sits inside it.
  const content = await page.locator("article").first().boundingBox();
  expect(content?.width).toBe(1280);
  await context.close();
});
