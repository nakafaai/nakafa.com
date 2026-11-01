import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The address of an exam's editor on the school host. */
const EDITOR_PATH = /\/exams\/[^/]+\/edit$/u;

/** The address of an exam's try as a student on the school host. */
const TRY_PATH = /\/exams\/[^/]+\/try$/u;

test("a teacher gives a question a shared reading and a video, and the student meets both above its text", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const host = `${school.slug}.localhost`;
  const context = await browser.newContext();
  await Effect.runPromise(
    signInOwner(context, school.slug, hostAddress(baseURL, host, "/"))
  );
  const page = await context.newPage();
  await page.goto(hostAddress(baseURL, host, "/exams"));
  await waitUntilTakenOver(page.getByRole("button", { name: "Create exam" }));
  await page.getByRole("button", { name: "Create exam" }).click();
  const create = page.getByRole("dialog");
  await create.getByRole("textbox", { name: "Exam title" }).fill("Menyimak");
  await create.getByRole("button", { name: "Create exam" }).click();
  await page.waitForURL(EDITOR_PATH);
  await expect(
    page.getByRole("textbox", { name: "Question 1 text" })
  ).toBeEditable({ timeout: readinessTimeoutMilliseconds });

  // A reading stands on the paper, written with the question's own editor.
  const panel = page.getByRole("complementary", { name: "For teachers" });
  await panel.getByRole("combobox", { name: "Shared reading" }).click();
  await page.getByRole("option", { name: "Its own reading" }).click();
  const reading = page.getByRole("textbox", { name: "Question 1 reading" });
  await expect(reading).toBeEditable({ timeout: readinessTimeoutMilliseconds });
  await reading.click();
  await page.keyboard.type("Pada suatu hari di pasar.");

  // Save waits for a link YouTube shares and for words that say what it holds.
  await panel.getByRole("button", { name: "Add video" }).click();
  const dialog = page.getByRole("dialog");
  const save = dialog.getByRole("button", { name: "Add" });
  await dialog
    .getByRole("textbox", { name: "YouTube link" })
    .fill("video saya");
  await dialog
    .getByRole("textbox", { name: "What it holds" })
    .fill("Percakapan");
  await expect(save).toBeDisabled();
  await dialog
    .getByRole("textbox", { name: "YouTube link" })
    .fill("https://youtu.be/dQw4w9WgXcQ");
  await save.click();
  await expect(panel.getByText("Percakapan")).toBeVisible();

  await page.getByRole("link", { name: "Try as student" }).click();
  await page.waitForURL(TRY_PATH);
  await expect(page.getByText("Pada suatu hari di pasar.")).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  // The video waits for the student's press, and its player keeps them on the paper.
  const video = page.getByRole("button", { name: "Percakapan" });
  await expect(video).toHaveCount(1);
  await video.click();
  const player = page.getByTitle("Percakapan");
  await expect(player).toBeVisible();
  expect(await player.getAttribute("sandbox")).not.toContain("allow-popups");
  await context.close();
});
