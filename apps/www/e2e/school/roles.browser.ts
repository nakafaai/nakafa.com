import { type Browser, expect, test } from "@playwright/test";
import { Effect } from "effect";
import { seedGuardianCode } from "@/e2e/support/guardian";
import { giveRole } from "@/e2e/support/roles";
import {
  createSchool,
  grantStudent,
  hostAddress,
  inviteLearner,
  seedCard,
  seedForum,
  seedGraduation,
  seedSitting,
  signInClassTeacher,
  signInOwner,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { walkSchool } from "@/e2e/support/walk";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** How long a whole walk may take: the role's setup, every page it reaches, and every popup of each. */
const WALK_MILLISECONDS = 15 * 60 * 1000;

/** The name that the acceptance runtime gives every learner it invites. */
const LEARNER_NAME = "Acceptance Learner";

/** The class teacher the class teacher's seed signs in, and the cohort it opens. */
const CLASS_TEACHER = "Acceptance Class Teacher";
const COHORT = "X-1";

/** The student the card seed adds, and the NISN the guardian seed writes on the roster. */
const CARD_STUDENT = "Siswa Uji";
const NISN = "0012345678";

/** Every role the other walks leave out, each at a desktop and a phone width. */
const WALKS = [
  { role: "admin", width: 1440 },
  { role: "admin", width: 390 },
  { role: "homeroom", width: 1440 },
  { role: "homeroom", width: 390 },
  { role: "proctor", width: 1440 },
  { role: "proctor", width: 390 },
  { role: "parent", width: 1440 },
  { role: "parent", width: 390 },
] as const;

type Role = (typeof WALKS)[number]["role"];

/** One school with a student, a sitting of three more, a forum and a graduation, and its Owner signed in. */
async function openSchool(browser: Browser, baseURL: string | undefined) {
  const school = await Effect.runPromise(createSchool());
  const home = hostAddress(baseURL, `${school.slug}.localhost`, "/");
  const owner = await browser.newContext();
  await Effect.runPromise(signInOwner(owner, school.slug, home));
  return { home, owner, slug: school.slug };
}

/** Invites the school's student, gives it its grant, and seeds its sitting and graduation. */
async function seedStudent(
  browser: Browser,
  school: Awaited<ReturnType<typeof openSchool>>
) {
  const learner = `student-${school.slug}@acceptance.example.test`;
  const context = await browser.newContext();
  await Effect.runPromise(
    inviteLearner({
      address: learner,
      baseURL: school.home,
      context,
      slug: school.slug,
    })
  );
  await context.close();
  await Effect.runPromise(grantStudent(school.slug, learner));
  const sitting = await Effect.runPromise(
    seedSitting(school.slug, learner, 3, "upcoming")
  );
  await Effect.runPromise(seedGraduation(school.slug, learner));
  return sitting;
}

/**
 * Signs a learner into `context` and gives it the role from the Owner's Roles page. The learner is
 * the school's only one when the role is given, so the picker names one person.
 */
async function signInWithRole(
  context: Awaited<ReturnType<Browser["newContext"]>>,
  school: Awaited<ReturnType<typeof openSchool>>,
  role: "Admin" | "Proctor"
) {
  await Effect.runPromise(
    inviteLearner({
      address: `${role.toLowerCase()}-${school.slug}@acceptance.example.test`,
      baseURL: school.home,
      context,
      slug: school.slug,
    })
  );
  const page = await school.owner.newPage();
  await page.goto(new URL("/settings/roles", school.home).href);
  await giveRole(page, { person: LEARNER_NAME, role });
  await page.close();
}

/** The Owner places the student in the class teacher's cohort and makes the class teacher its homeroom teacher. */
async function makeHomeroom(school: Awaited<ReturnType<typeof openSchool>>) {
  const page = await school.owner.newPage();
  await page.goto(new URL("/settings/cohorts", school.home).href);
  const cohort = page.getByRole("link", { exact: true, name: COHORT });
  await waitUntilTakenOver(cohort);
  await cohort.click();
  await page
    .locator("header")
    .getByRole("button", { name: "Add student" })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox", { name: "Student" }).click();
  await page.getByRole("option", { name: LEARNER_NAME }).click();
  await dialog.getByRole("button", { name: "Add student" }).click();
  await page.getByRole("combobox", { name: "Teacher" }).click();
  await page.getByRole("option", { name: CLASS_TEACHER }).click();
  await page.getByRole("button", { exact: true, name: "Save" }).click();
  await expect(page.getByText(CLASS_TEACHER).first()).toBeVisible();
  await page.close();
}

/** The Owner links a parent to the card's student, and the parent signs in with the email code. */
async function signInParent(
  context: Awaited<ReturnType<Browser["newContext"]>>,
  school: Awaited<ReturnType<typeof openSchool>>
) {
  const email = `ibu.${school.slug}@example.com`;
  await Effect.runPromise(seedCard(school.slug));
  const settings = await school.owner.newPage();
  await settings.goto(new URL("/settings/guardians", school.home).href);
  const link = settings
    .locator("header")
    .getByRole("button", { name: "Link a parent" });
  await waitUntilTakenOver(link);
  await link.click();
  const dialog = settings.getByRole("dialog");
  await dialog.getByRole("combobox", { name: "Student" }).click();
  await settings.getByRole("option", { name: CARD_STUDENT }).click();
  await dialog.getByLabel("Parent's name").fill("Ibu Uji");
  await dialog.getByLabel("Parent email").fill(email);
  await dialog.getByRole("button", { name: "Link a parent" }).click();
  await expect(
    settings.getByRole("row").filter({ hasText: CARD_STUDENT })
  ).toContainText("Pending");
  await settings.close();

  const page = await context.newPage();
  await page.goto(new URL("/parents", school.home).href);
  const send = page.getByRole("button", { name: "Send code" });
  await waitUntilTakenOver(send);
  await page.getByLabel("Parent email").fill(email);
  await send.click();
  await expect(page.getByLabel("Sign-in code")).toBeVisible();
  const seeded = await Effect.runPromise(
    seedGuardianCode(school.slug, email, NISN)
  );
  await page.getByLabel("Sign-in code").fill(seeded.code);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: CARD_STUDENT })).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await page.close();
}

/** Signs the role into `context` in a school with records, and names the pages its walk starts from. */
async function openRole(
  browser: Browser,
  baseURL: string | undefined,
  role: Role,
  context: Awaited<ReturnType<Browser["newContext"]>>
) {
  const school = await openSchool(browser, baseURL);
  if (role === "parent") {
    await signInParent(context, school);
    await school.owner.close();
    return { origin: new URL(school.home).origin, seeds: ["/parents"] };
  }
  if (role === "homeroom") {
    await Effect.runPromise(
      signInClassTeacher(context, school.slug, school.home)
    );
    const { examId, sittingId } = await seedStudent(browser, school);
    await Effect.runPromise(seedForum(school.slug, 12, 6));
    await makeHomeroom(school);
    await school.owner.close();
    return {
      origin: new URL(school.home).origin,
      seeds: [
        "/reports",
        "/insight",
        "/graduation",
        "/grades",
        `/exams/${examId}`,
        `/exams/${examId}/sittings/${sittingId}/results`,
      ],
    };
  }
  await signInWithRole(context, school, role === "admin" ? "Admin" : "Proctor");
  const { examId, sittingId } = await seedStudent(browser, school);
  await school.owner.close();
  return {
    origin: new URL(school.home).origin,
    seeds: [
      "/sittings",
      `/sittings/${sittingId}`,
      `/exams/${examId}`,
      `/exams/${examId}/sittings/${sittingId}`,
      `/exams/${examId}/sittings/${sittingId}/results`,
    ],
  };
}

test.describe.configure({ mode: "parallel" });

for (const { role, width } of WALKS) {
  test(`the ${role} of a school with records opens every page and popup at ${width}`, async ({
    baseURL,
    browser,
  }) => {
    test.setTimeout(WALK_MILLISECONDS);
    const context = await browser.newContext({
      viewport: { height: 844, width },
    });
    const { origin, seeds } = await openRole(browser, baseURL, role, context);
    const opened = await walkSchool(context, origin, seeds);
    expect(opened.length).toBeGreaterThan(1);
    await context.close();
  });
}
