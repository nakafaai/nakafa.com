import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import {
  createSchool,
  hostAddress,
  signInOwner,
  signInTeacher,
} from "@/e2e/support/school";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The name that the acceptance runtime gives the Teacher of a school. */
const TEACHER = "Acceptance Teacher";

for (const width of [390, 1440]) {
  test(`an Owner removes a teacher who joined, and the teacher's open page shows what a reload shows, at ${width}`, async ({
    browser,
    baseURL,
  }) => {
    const school = await Effect.runPromise(createSchool());
    const address = (path: string) =>
      hostAddress(baseURL, `${school.slug}.localhost`, path);
    const viewport = { height: 900, width };

    const teacherContext = await browser.newContext({ viewport });
    await Effect.runPromise(
      signInTeacher(teacherContext, school.slug, address("/"))
    );
    const teacher = await teacherContext.newPage();
    await teacher.goto(address("/exams"));
    await waitUntilTakenOver(
      teacher.locator('[data-slot="page-header"]').getByRole("button").first()
    );

    const ownerContext = await browser.newContext({ viewport });
    await Effect.runPromise(
      signInOwner(ownerContext, school.slug, address("/"))
    );
    const owner = await ownerContext.newPage();
    await owner.goto(address("/settings/members"));
    const row = owner.getByRole("row").filter({ hasText: TEACHER });
    const more = row.getByRole("button", { name: "More actions" });
    await waitUntilTakenOver(more);
    await more.click();
    await owner.getByRole("menuitem", { name: "Remove" }).click();
    await owner
      .getByRole("dialog", { name: "Remove this member?" })
      .getByRole("button", { name: "Remove" })
      .click();
    await expect(row).toHaveCount(0);

    await expect(
      teacher.getByRole("heading", { name: "Not a member" })
    ).toBeVisible();
    await expect(teacher).toHaveURL(address("/exams"));
    await teacher.reload();
    await expect(
      teacher.getByRole("heading", { name: "Not a member" })
    ).toBeVisible();

    await ownerContext.close();
    await teacherContext.close();
  });
}
