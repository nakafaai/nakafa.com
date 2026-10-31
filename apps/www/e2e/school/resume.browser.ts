import { type Browser, expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { trackChanges } from "@/e2e/support/changes";
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

/** A student of a new school at the entry of an open sitting, the token typed, with the page's traffic in hand. */
async function studentAtEntry(
  baseURL: string | undefined,
  browser: Browser,
  name: string
) {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const learner = `${name}-${school.slug}@acceptance.example.test`;
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
  const sitting = await Effect.runPromise(seedSitting(school.slug, learner));

  const student = await studentContext.newPage();
  const changes = await Effect.runPromise(trackChanges(student, []));
  await student.goto(address(`/sittings/${sitting.sittingId}`));
  await waitUntilTakenOver(
    student.getByRole("button", { name: "Enter sitting" })
  );
  await student
    .getByPlaceholder("Enter the token from your proctor")
    .fill(sitting.token);
  return { changes, student, studentContext };
}

test("an entry that the server failed goes again by itself, so the student reaches the paper with one press", async ({
  baseURL,
  browser,
}) => {
  const { changes, student, studentContext } = await studentAtEntry(
    baseURL,
    browser,
    "retry"
  );

  // The first call never reaches the server, and the page is told the server could not take it.
  changes.failNext("exams/sittings:enter");
  await student.getByRole("button", { name: "Enter sitting" }).click();
  await expect(
    student
      .getByRole("article", { name: "Question 1" })
      .getByRole("radio")
      .first()
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });

  // Both calls carry one device, so the retry cannot open a second attempt.
  const [first, second, ...others] = changes.argumentsOf(
    "exams/sittings:enter"
  );
  expect(second).toEqual(first);
  expect(others).toHaveLength(0);
  await studentContext.close();
});

test("a server failure of a paper's read keeps the student in the paper's frame, and the paper comes back by itself", async ({
  baseURL,
  browser,
}) => {
  const { changes, student, studentContext } = await studentAtEntry(
    baseURL,
    browser,
    "recover"
  );
  await student.getByRole("button", { name: "Enter sitting" }).click();
  const option = student
    .getByRole("article", { name: "Question 1" })
    .getByRole("radio")
    .first();
  await expect(option).toBeVisible({ timeout: readinessTimeoutMilliseconds });

  // The next read of what the student saved fails with a failure that names no refusal, as a function that ran
  // out of time does, so the paper leaves and the frame stays.
  changes.failQuery("exams/sittings:saved", "ServerBroke");
  await option.click();
  await expect(student.getByRole("article")).toHaveCount(0, {
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(
    student.getByRole("heading", { name: "Something broke" })
  ).toHaveCount(0);

  // The server answers again, and the paper is back with the student's answer, with no press.
  changes.recoverQuery();
  await expect(
    student
      .getByRole("article", { name: "Question 1" })
      .getByRole("radio")
      .first()
  ).toBeChecked({ timeout: readinessTimeoutMilliseconds });
  await studentContext.close();
});

test("a server failure of one read keeps a teacher in the school, and the page comes back by itself", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const ownerContext = await browser.newContext();
  await Effect.runPromise(signInOwner(ownerContext, school.slug, address("/")));
  const teacher = await ownerContext.newPage();
  const changes = await Effect.runPromise(trackChanges(teacher, []));
  await teacher.goto(address("/exams"));
  const create = teacher.getByRole("button", { name: "Create exam" });
  await expect(create).toBeVisible({ timeout: readinessTimeoutMilliseconds });

  // The list's read fails with a failure that names no refusal, as a function that ran out of time does, so the page
  // leaves and the school's shell stays around it.
  changes.failQuery("exams/exams:list", "ServerBroke");
  await teacher.reload();
  const shell = teacher.getByRole("link", { exact: true, name: "Exams" });
  await expect(shell).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await expect(
    teacher.getByRole("heading", { name: "Something broke" })
  ).toHaveCount(0);

  // The server answers again, and the page is back with no press.
  changes.recoverQuery();
  await expect(create).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await ownerContext.close();
});
