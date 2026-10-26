import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The address of an exam's editor on the school host. */
const EDITOR_PATH = /\/exams\/[^/]+\/edit$/;

/** The exams list on the school host, where a deleted draft lands. */
const EXAMS_PATH = /\/exams$/;

/** The title of the draft that the test deletes. */
const TITLE = "Ulangan Hapus";

/** What the editor or the list must never show while a draft is deleted: the unavailable state and the load errors. */
const BROKEN = ["This exam is not available.", "We could not load this data."];

/** What the page recorded when the exams list showed the deleted draft, even for one frame. */
const FLASHED = "the deleted draft in the exams list";

/**
 * Deleting a draft from its editor lands on the exams at once, without the draft, and the page never
 * shows the unavailable exam, an error, or the draft in the list on the way: the editor is left before
 * the server deletes the exam that its live read follows.
 */
test("a teacher deletes a draft from its editor and lands on the exams without an error on the way", async ({
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
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Exam title" }).fill(TITLE);
  await dialog.getByRole("button", { name: "Create exam" }).click();
  await page.waitForURL(EDITOR_PATH);
  await expect(
    page.getByRole("button", { name: "More actions" })
  ).toBeVisible();

  // Record every text the page shows from the press of Delete until the exams settle, and the draft's
  // title on the exams list, where it must never appear once the editor is left.
  await page.evaluate(
    ({ broken, flashed, title }) => {
      const seen: string[] = [];
      Object.assign(window, { nakafaSeenBroken: seen });
      const record = () => {
        const text = document.body.innerText;
        for (const phrase of broken) {
          if (text.includes(phrase)) {
            seen.push(phrase);
          }
        }
        if (location.pathname.endsWith("/exams") && text.includes(title)) {
          seen.push(flashed);
        }
      };
      new MutationObserver(record).observe(document.body, {
        characterData: true,
        childList: true,
        subtree: true,
      });
    },
    { broken: BROKEN, flashed: FLASHED, title: TITLE }
  );

  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Delete exam" }).click();
  const confirm = page.getByRole("dialog");
  await expect(confirm.getByText("Delete this exam?")).toBeVisible();
  await confirm.getByRole("button", { name: "Delete", exact: true }).click();

  await page.waitForURL(EXAMS_PATH);
  await expect(page.getByText(TITLE)).toHaveCount(0);
  await page.waitForTimeout(1500);
  const seen = await page.evaluate(() =>
    Reflect.get(window, "nakafaSeenBroken")
  );
  expect(seen).toStrictEqual([]);
  // The draft stays gone after a reload, so the delete reached the server.
  await page.reload();
  await expect(page.getByRole("button", { name: "Create exam" })).toBeVisible();
  await expect(page.getByText(TITLE)).toHaveCount(0);
  await context.close();
});
