import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { expectNoOverflow } from "@/e2e/support/layout";
import {
  createSchool,
  hostAddress,
  inviteLearner,
  seedSitting,
  signInOwner,
} from "@/e2e/support/school";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The narrowest phones a school's students bring. */
const WIDTHS = [320, 390] as const;

for (const width of WIDTHS) {
  test(`a student sits a whole exam on a ${width} px phone: enters, answers, jumps, flags and finishes`, async ({
    baseURL,
    browser,
  }) => {
    const school = await Effect.runPromise(createSchool());
    const address = (path: string) =>
      hostAddress(baseURL, `${school.slug}.localhost`, path);
    const learner = `phone-${school.slug}@acceptance.example.test`;
    const context = await browser.newContext({
      hasTouch: true,
      viewport: { height: 700, width },
    });
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
    await Effect.runPromise(
      signInOwner(ownerContext, school.slug, address("/"))
    );
    const sitting = await Effect.runPromise(seedSitting(school.slug, learner));

    const student = await context.newPage();
    await student.goto(address(`/sittings/${sitting.sittingId}`));
    const enter = student.getByRole("button", { name: "Enter sitting" });
    await waitUntilTakenOver(enter);
    await student.getByPlaceholder("Enter the token").fill(sitting.token);
    await enter.click();

    const first = student.getByRole("article", { name: "Question 1" });
    await expect(first).toBeVisible();
    await Effect.runPromise(expectNoOverflow(student, "the paper"));
    await first.getByRole("radio").first().click();
    await expect(first.getByRole("radio").first()).toBeChecked();

    // The navigator opens from the footer, and a number in it closes the drawer.
    await student
      .getByRole("button", { name: /^Open the question navigator/u })
      .click();
    const drawer = student.getByRole("dialog", { name: "Questions" });
    await drawer
      .getByRole("button", { exact: true, name: "Question 2, unanswered" })
      .click();
    await expect(drawer).toBeHidden();

    const flag = student.getByRole("button", {
      exact: true,
      name: "Flag question 2",
    });
    await flag.click();
    await expect(flag).toHaveAttribute("aria-pressed", "true");

    await student.getByRole("button", { exact: true, name: "Finish" }).click();
    await student
      .getByRole("dialog")
      .getByRole("button", { exact: true, name: "Finish" })
      .click();
    await expect(student.getByText("You finished this exam.")).toBeVisible();
    await Effect.runPromise(expectNoOverflow(student, "the end"));

    await context.close();
    await ownerContext.close();
  });
}
