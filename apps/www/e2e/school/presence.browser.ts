import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import {
  createSchool,
  hostAddress,
  signInOwner,
  signInTeacher,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The address of an exam's editor on the school host. */
const EDITOR_PATH = /\/exams\/[^/]+\/edit$/;

/** The header of the editor, which holds the exam's title. */
function editorHeader(page: Page) {
  return page
    .locator("header")
    .filter({ has: page.getByRole("textbox", { name: "Exam title" }) });
}

test("two teachers in one exam see each other in the editor header, and a teacher who leaves the editor leaves the row", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const host = `${school.slug}.localhost`;
  const ownerContext = await browser.newContext();
  const teacherContext = await browser.newContext();
  await Effect.runPromise(
    signInOwner(ownerContext, school.slug, hostAddress(baseURL, host, "/"))
  );
  await Effect.runPromise(
    signInTeacher(teacherContext, school.slug, hostAddress(baseURL, host, "/"))
  );

  const owner = await ownerContext.newPage();
  await owner.goto(hostAddress(baseURL, host, "/exams"));
  await owner.getByRole("button", { name: "Create exam" }).click();
  const dialog = owner.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Exam title" }).fill("PTS Kimia");
  await dialog.getByRole("button", { name: "Create exam" }).click();
  await owner.waitForURL(EDITOR_PATH);

  // Alone in the exam, the Owner sees no one, and the actions keep their place when the row comes.
  const ownerHeader = editorHeader(owner);
  const tryAction = ownerHeader.getByRole("link", { name: "Try as student" });
  await expect(tryAction).toBeVisible();
  const before = await tryAction.boundingBox();

  const teacher = await teacherContext.newPage();
  await teacher.goto(owner.url());
  const teacherOnOwner = ownerHeader.getByRole("button", {
    name: "Acceptance Teacher is editing",
  });
  await expect(teacherOnOwner).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(
    editorHeader(teacher).getByRole("button", {
      name: "Acceptance Owner is editing",
    })
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  expect(await tryAction.boundingBox()).toEqual(before);

  // Each sees only the other: neither header names its own teacher.
  await expect(
    ownerHeader.getByRole("button", { name: "Acceptance Owner is editing" })
  ).toHaveCount(0);

  // The avatar's tooltip names the teacher.
  await teacherOnOwner.hover();
  await expect(owner.getByText("Acceptance Teacher", { exact: true })).toBeVisible();

  // The teacher goes back to the exams, so the editor closes and the Owner's row empties.
  await editorHeader(teacher).getByRole("link", { name: "Exams" }).click();
  await teacher.waitForURL(/\/exams$/);
  await expect(teacherOnOwner).toHaveCount(0, {
    timeout: readinessTimeoutMilliseconds,
  });

  await teacherContext.close();
  await ownerContext.close();
});
