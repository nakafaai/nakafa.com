import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import {
  createSchool,
  hostAddress,
  signInClassTeacher,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

for (const viewport of [
  { height: 844, width: 390 },
  { height: 900, width: 1440 },
]) {
  test(`a class's People tab names who teaches it, at ${viewport.width} px`, async ({
    baseURL,
    browser,
  }) => {
    const school = await Effect.runPromise(createSchool());
    const address = (path: string) =>
      hostAddress(baseURL, `${school.slug}.localhost`, path);
    const context = await browser.newContext({ viewport });
    await Effect.runPromise(
      signInClassTeacher(context, school.slug, address("/"))
    );
    const page = await context.newPage();
    await page.goto(address("/classes/fisika-x-1"));
    await page
      .getByRole("tablist", { name: "Class" })
      .getByRole("tab", { name: "People" })
      .click();
    await expect(
      page.getByRole("cell", { name: "Teacher" }).first()
    ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
    await context.close();
  });
}
