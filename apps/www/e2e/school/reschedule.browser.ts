import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { saved, trackChanges } from "@/e2e/support/changes";
import {
  createSchool,
  hostAddress,
  inviteLearner,
  seedSitting,
  signInOwner,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The room of the seeded exam that opens tomorrow, which no student has sat yet. */
const UPCOMING_ROOM = "Lab 3";

test("an admin moves a room that has not opened to a new name from its row, the dialog filled in with the room as it is, and the move stays after a reload", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const learner = `student-${school.slug}@acceptance.example.test`;
  const learnerContext = await browser.newContext();
  await Effect.runPromise(
    inviteLearner({
      address: learner,
      baseURL: address("/"),
      context: learnerContext,
      slug: school.slug,
    })
  );
  await learnerContext.close();
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const sitting = await Effect.runPromise(
    seedSitting(school.slug, learner, 0, "upcoming")
  );

  const page = await context.newPage();
  const changes = await Effect.runPromise(trackChanges(page, []));
  await page.goto(address(`/exams/${sitting.examId}`));
  const row = page.getByRole("row", { name: new RegExp(UPCOMING_ROOM, "u") });
  const menu = row.getByRole("button", { name: "More actions" });
  await expect(menu).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await waitUntilTakenOver(menu);
  await menu.click();
  await page.getByRole("menuitem", { name: "Reschedule" }).click();

  // The dialog opens with the room as it is, and saves only once something changes.
  const dialog = page.getByRole("dialog");
  const name = dialog.getByRole("textbox", { name: "Room" });
  await expect(name).toHaveValue(UPCOMING_ROOM);
  await expect(dialog.getByRole("button", { name: "Save" })).toBeDisabled();
  await name.fill("Aula");
  const sentBefore = changes.sent;
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(
    page.getByRole("link", { exact: true, name: "Aula" })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { exact: true, name: UPCOMING_ROOM })
  ).toHaveCount(0);

  // A reload drops a change still on its way, so it waits for the server to answer the move.
  await saved(changes, sentBefore);
  await page.reload();
  await expect(
    page.getByRole("link", { exact: true, name: "Aula" })
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await context.close();
});
