import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import {
  createSchool,
  hostAddress,
  inviteLearner,
  seedSitting,
  signInOwner,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The essay the student types into the seeded third question. */
const ESSAY = "Tumbuhan mengubah cahaya matahari menjadi energi kimia.";

/** The mark a page holds once the entry's button has shown. */
const ENTRY_SEEN = "__entrySeen";

/** Marks the page once the entry's button shows, from the document's first script on, reloads included. */
async function watchEntry(page: Page) {
  await page.addInitScript(
    ({ label, mark }) => {
      new MutationObserver(() => {
        const shown = [...document.querySelectorAll("button")].some(
          (button) => button.textContent?.trim() === label
        );
        if (shown) {
          document.documentElement.setAttribute(mark, "");
        }
      }).observe(document, { childList: true, subtree: true });
    },
    { label: "Enter sitting", mark: ENTRY_SEEN }
  );
}

test("a student who reloads a running paper meets the paper and never the token field, with the words typed before the reload, and no editor draws it", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const learner = `resume-${school.slug}@acceptance.example.test`;
  const studentContext = await browser.newContext();
  await Effect.runPromise(
    inviteLearner({
      address: learner,
      baseURL: address("/"),
      context: studentContext,
      slug: school.slug,
    })
  );
  // The seed opens the sitting in the school's first active unit, which the school has once its Owner signed in.
  const ownerContext = await browser.newContext();
  await Effect.runPromise(signInOwner(ownerContext, school.slug, address("/")));
  await ownerContext.close();
  const sitting = await Effect.runPromise(
    seedSitting(school.slug, learner, 0, "essay")
  );

  const student = await studentContext.newPage();
  await watchEntry(student);
  await student.goto(address(`/sittings/${sitting.sittingId}`));
  await waitUntilTakenOver(
    student.getByRole("button", { name: "Enter sitting" })
  );
  await student
    .getByPlaceholder("Enter the token from your proctor")
    .fill(sitting.token);
  await student.getByRole("button", { name: "Enter sitting" }).click();
  const question = student.getByRole("article", { name: "Question 3" });
  const essay = question.getByRole("textbox", { name: "Question 3" });
  await expect(essay).toBeVisible({ timeout: readinessTimeoutMilliseconds });

  // A paper is drawn, not edited: its prompt and its options hold no editor, and an option is named by its words.
  await expect(student.getByText("Soal pertama.")).toBeVisible();
  await expect(student.locator(".ProseMirror")).toHaveCount(0);

  // The words go into the field and the page reloads before their pause ends, so only the browser holds them.
  await essay.pressSequentially(ESSAY);
  await student.reload();
  await expect(
    student
      .getByRole("article", { name: "Question 3" })
      .getByRole("textbox", { name: "Question 3" })
  ).toHaveValue(ESSAY, { timeout: readinessTimeoutMilliseconds });

  // The reloaded document never showed the token field: the page entered by itself behind the paper's frame.
  await expect(student.locator("html")).not.toHaveAttribute(ENTRY_SEEN, "");
  await studentContext.close();
});
