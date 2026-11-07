import { expect, test } from "@playwright/test";
import { Effect, MutableList, Option, String as Str } from "effect";
import {
  createSchool,
  hostAddress,
  inviteLearner,
  seedGraduation,
  signInClassTeacher,
  signInOwner,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** A web address, as an opened PDF has. */
const WEB_ADDRESS = /^https?:\/\//u;

/** The hash at the end of a check page's address. */
const CHECK_HASH = /\/verify\/(?<hash>[0-9a-f]{64})$/u;

test("the Owner records the graduation decision, issues the SKL, opens its check page, and saves the e-Ijazah and Dapodik files", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const learnerAddress = `student-${school.slug}@acceptance.example.test`;
  const learnerContext = await browser.newContext();
  await Effect.runPromise(
    inviteLearner({
      address: learnerAddress,
      baseURL: address("/"),
      context: learnerContext,
      slug: school.slug,
    })
  );
  await learnerContext.close();
  // The class teacher's seed opens the school's active period, which the graduation joins.
  const teacher = await browser.newContext();
  await Effect.runPromise(
    signInClassTeacher(teacher, school.slug, address("/"))
  );
  await teacher.close();
  const owner = await browser.newContext({ acceptDownloads: true });
  await Effect.runPromise(signInOwner(owner, school.slug, address("/")));
  const graduation = await Effect.runPromise(
    seedGraduation(school.slug, learnerAddress)
  );

  // The graduating class group lists its student with the transcript average and what is missing.
  const page = await owner.newPage();
  await page.goto(address("/graduation"));
  const cohortLink = page.getByRole("link", {
    exact: true,
    name: graduation.cohort,
  });
  await expect(cohortLink).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await waitUntilTakenOver(cohortLink);
  await cohortLink.click();
  // The students stand in the one card of a table page, as every settings table does.
  const row = page
    .locator('[data-slot="table-card"]')
    .getByRole("row")
    .filter({ hasText: "Acceptance Learner" });
  await expect(row).toContainText("No decision yet", {
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(row).toContainText("88.50");

  // The Owner records the head's decision, whose date the rules suggest, and issues the SKL.
  const more = page
    .locator("header")
    .getByRole("button", { name: "More actions" });
  await waitUntilTakenOver(more);
  await more.click();
  await page.getByRole("menuitem", { name: "Decide graduation" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Decision number").fill("421.3/045/SMA.1/2027");
  await dialog.getByLabel("Place of issue").fill("Bandung");
  await dialog.getByLabel("Head of school").fill("Dra. Siti Aminah, M.Pd.");
  await dialog.getByRole("button", { name: "Save decision" }).click();
  await expect(row).toContainText("Ready");
  await page
    .locator("header")
    .getByRole("button", { name: "Issue letters" })
    .click();
  await expect(row).toContainText("Issued", {
    timeout: readinessTimeoutMilliseconds,
  });

  // The student opens beside the list with the transcript, the SKL's PDF, and its check page.
  await row.getByRole("button", { name: "Acceptance Learner" }).click();
  const detail = page.getByRole("complementary", {
    name: "Student's graduation",
  });
  await expect(detail.getByRole("cell", { name: "Matematika" })).toBeVisible();
  await expect(detail.getByRole("link", { name: "Open SKL" })).toHaveAttribute(
    "href",
    WEB_ADDRESS
  );
  const check = await detail
    .getByRole("link", { name: "Open check page" })
    .getAttribute("href");
  const code = Option.getOrElse(
    Option.flatMap(Str.match(CHECK_HASH)(check ?? ""), (found) =>
      Option.fromNullishOr(found.groups?.hash)
    ),
    () => ""
  );
  expect(code).toHaveLength(64);

  // The e-Ijazah readiness workbook saves under the class group's name.
  const readiness = page.waitForEvent("download");
  await more.click();
  await page.getByRole("menuitem", { name: "Export for e-Ijazah" }).click();
  expect((await readiness).suggestedFilename()).toBe(
    `e-ijazah-${Str.toLowerCase(graduation.cohort)}.xlsx`
  );

  // The check page answers the SKL on the main site, and nothing about its student.
  const visitor = await browser.newContext();
  const checkPage = await visitor.newPage();
  await checkPage.goto(hostAddress(baseURL, "localhost", `/en/verify/${code}`));
  await expect(
    checkPage.getByText("This graduation letter is on record.")
  ).toBeVisible();
  await expect(checkPage.getByText("Graduation letter (SKL)")).toBeVisible();
  await expect(checkPage.getByText("Acceptance Learner")).toHaveCount(0);
  await visitor.close();

  // The Dapodik page saves the class group's report grades to paste into Dapodik's template.
  await page.goto(address("/settings/roster"));
  const exportGrades = page
    .locator("header")
    .getByRole("button", { exact: true, name: "Export" });
  await expect(exportGrades).toBeEnabled({
    timeout: readinessTimeoutMilliseconds,
  });
  await waitUntilTakenOver(exportGrades);
  const ledger = page.waitForEvent("download");
  await exportGrades.click();
  await page.getByRole("menuitem", { name: "Report grades" }).click();
  await page.getByRole("menuitem", { name: graduation.cohort }).click();
  expect((await ledger).suggestedFilename()).toBe(
    `dapodik-nilai-${Str.toLowerCase(graduation.cohort)}.xlsx`
  );
  await owner.close();
});

/** The address of a class group's settings page, whose last part is the class group's ID. */
const COHORT_PAGE = /\/settings\/cohorts\/(?<id>[^/]+)$/u;

/** What the page says of the seeded X-1, a grade 10 class group of a unit whose grade 12 graduates. */
const NOT_GRADUATING =
  /^Only grade 12 of .+ graduates, and X-1 is in grade 10\.$/u;

test("a class group outside the last grade answers that it does not graduate, in the list's card, with the way back to the graduation", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  // The class teacher's seed opens the active period with the class group X-1 in grade 10.
  const teacher = await browser.newContext();
  await Effect.runPromise(
    signInClassTeacher(teacher, school.slug, address("/"))
  );
  await teacher.close();
  const owner = await browser.newContext();
  await Effect.runPromise(signInOwner(owner, school.slug, address("/")));
  const page = await owner.newPage();
  const errors = MutableList.make<string>();
  page.on("pageerror", (error) => MutableList.append(errors, String(error)));

  await page.goto(address("/settings/cohorts"));
  const cohort = page.getByRole("link", { exact: true, name: "X-1" });
  await expect(cohort).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  const id = Option.getOrElse(
    Option.flatMap(
      Str.match(COHORT_PAGE)((await cohort.getAttribute("href")) ?? ""),
      (found) => Option.fromNullishOr(found.groups?.id)
    ),
    () => ""
  );
  expect(id).not.toBe("");

  await page.goto(address(`/graduation/${id}`));
  const card = page.locator('[data-slot="table-card"]');
  await expect(card.getByText("X-1 does not graduate.")).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(card.getByText(NOT_GRADUATING)).toBeVisible();
  await expect(page.getByText("We could not load this data.")).toHaveCount(0);
  await expect(card.getByRole("table")).toHaveCount(0);
  // A class group with no list has nothing to search and nothing to issue.
  await expect(
    page.locator("header").getByRole("button", { name: "More actions" })
  ).toHaveCount(0);

  const back = card.getByRole("link", { name: "View graduation" });
  await waitUntilTakenOver(back);
  await back.click();
  await expect(page).toHaveURL(address("/graduation"));
  expect(MutableList.toArray(errors)).toEqual([]);
  await owner.close();
});
