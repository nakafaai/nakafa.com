import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { saved, trackChanges } from "@/e2e/support/changes";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The address of an exam's editor on the school host. */
const EDITOR_PATH = /\/exams\/[^/]+\/edit$/;

/** The address of an exam's rooms on the school host, where a schedule goes once it is saved. */
const ROOMS_PATH = /\/exams\/[^/]+$/;

/** The thumbnail of the first question, whose name starts with its number. */
const FIRST_QUESTION = /^Question 1\b/;
const SECOND_QUESTION = /^Question 2\b/;
/** A prompt with more steps than a fold waits for, so typing it moves the snapshot. */
const LONG_PROMPT =
  "Sebuah mobil melaju 60 km/jam selama 2 jam. Berapa jarak yang ditempuh?";

/** The four options of the question, each with its letter and its text. The second one is correct. */
const OPTIONS = [
  { letter: "A", text: "4" },
  { letter: "B", text: "5" },
  { letter: "C", text: "6" },
  { letter: "D", text: "7" },
];

test("a teacher creates an exam, adds questions, writes one, and finds it all when the editor opens again, with the dot on a question without a key", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const host = `${school.slug}.localhost`;
  const context = await browser.newContext();
  await Effect.runPromise(
    signInOwner(context, school.slug, hostAddress(baseURL, host, "/"))
  );
  const page = await context.newPage();
  await page.goto(hostAddress(baseURL, host, "/exams"));

  // The sidebar marks the exams entry as the current page, never home.
  const sidebar = page.locator('[data-sidebar="sidebar"]:visible');
  await expect(sidebar.getByRole("link", { name: "Exams" })).toHaveAttribute(
    "data-active",
    "true"
  );
  await expect(sidebar.getByRole("link", { name: "Home" })).toHaveAttribute(
    "data-active",
    "false"
  );

  // The page has one header: the sidebar's trigger, the path, and Create exam share its row.
  const header = page
    .locator("header")
    .filter({ has: page.getByRole("button", { name: "Create exam" }) });
  await expect(
    header.getByRole("button", { name: "Toggle Sidebar" })
  ).toBeVisible();
  await expect(
    header.getByRole("navigation", { name: "breadcrumb" })
  ).toContainText("Exams");
  await expect(
    page.getByRole("button", { name: "Toggle Sidebar" })
  ).toHaveCount(1);

  // The dialog preselects the school's unit, whose language it shows.
  await page.getByRole("button", { name: "Create exam" }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("textbox", { name: "Exam title" })
    .fill("PTS Matematika");
  await dialog.getByRole("button", { name: "Create exam" }).click();
  await page.waitForURL(EDITOR_PATH);
  await expect(page.getByRole("textbox", { name: "Exam title" })).toHaveValue(
    "PTS Matematika"
  );

  // The editor fills the page: no school sidebar, and a link back to the exams.
  await expect(page.locator('[data-sidebar="sidebar"]:visible')).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Exams" })).toBeVisible();

  // A new exam starts with one question, and each added question is selected at once.
  await page.getByRole("button", { name: "Add question" }).click();
  await expect(page.getByRole("heading", { name: "Question 2" })).toBeVisible();
  await page.getByRole("button", { name: "Add question" }).click();
  await expect(page.getByRole("heading", { name: "Question 3" })).toBeVisible();

  // The first question gets a prompt, four options, and a correct answer.
  const strip = page.getByRole("navigation", { name: "Questions" });
  await strip.getByRole("button", { name: FIRST_QUESTION }).click();
  const prompt = page.getByRole("textbox", { name: "Question text" });
  await expect(prompt).toBeEditable();
  await prompt.click();
  await page.keyboard.type("Berapa hasil 2 + 3?");
  // The open question's thumbnail draws what its editor holds, as the teacher types.
  await expect(
    strip.getByRole("button", { name: FIRST_QUESTION })
  ).toContainText("Berapa hasil 2 + 3?");

  for (const option of OPTIONS) {
    const field = page.getByRole("textbox", {
      name: `Option ${option.letter}`,
    });
    await field.fill(option.text);
    await field.press("Tab");
  }
  await page.getByRole("radio", { name: "Mark option B as correct" }).click();
  await expect(
    page.getByRole("radio", { name: "Mark option B as correct" })
  ).toBeChecked();

  // Everything the teacher wrote reaches the server, so the editor opened again shows it.
  // Its queries are live: a save still on its way shows as soon as it lands, where a reload
  // of this page would cancel it. The prompt turns editable once its document has opened,
  // with its steps applied.
  const reopened = await context.newPage();
  await reopened.goto(page.url());
  const reopenedPrompt = reopened.getByRole("textbox", {
    name: "Question text",
  });
  await expect(reopenedPrompt).toBeEditable({
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(reopenedPrompt).toContainText("Berapa hasil 2 + 3?", {
    timeout: readinessTimeoutMilliseconds,
  });
  for (const option of OPTIONS) {
    await expect(
      reopened.getByRole("textbox", { name: `Option ${option.letter}` })
    ).toHaveValue(option.text, { timeout: readinessTimeoutMilliseconds });
  }
  await expect(
    reopened.getByRole("radio", { name: "Mark option B as correct" })
  ).toBeChecked({ timeout: readinessTimeoutMilliseconds });

  // The two added questions have no key, so each shows its dot, and the first does not.
  const reopenedStrip = reopened.getByRole("navigation", { name: "Questions" });
  await expect(
    reopenedStrip.getByText("This question has no answer key yet.")
  ).toHaveCount(2);

  // A question the canvas does not show draws its page from what the server holds.
  await reopenedStrip.getByRole("button", { name: SECOND_QUESTION }).click();
  await expect(
    reopened.getByRole("heading", { name: "Question 2" })
  ).toBeVisible();
  const firstThumbnail = reopenedStrip.getByRole("button", {
    name: FIRST_QUESTION,
  });
  await expect(firstThumbnail).toContainText("Berapa hasil 2 + 3?", {
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(firstThumbnail.locator('input[data-slot="input"]')).toHaveCount(
    OPTIONS.length
  );

  // A question without a key keeps the exam from being scheduled: the dialog names the keys,
  // and its submit stays off.
  await reopened.getByRole("button", { name: "Schedule" }).click();
  const scheduling = reopened.getByRole("dialog");
  await expect(
    scheduling.getByText("Mark the correct answer of every question first.")
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await expect(
    scheduling.getByRole("button", { name: "Schedule" })
  ).toBeDisabled();
  await context.close();
});

test("a teacher schedules a sitting of an exam whose question has its key, and the sitting opens", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const host = `${school.slug}.localhost`;
  const context = await browser.newContext();
  await Effect.runPromise(
    signInOwner(context, school.slug, hostAddress(baseURL, host, "/"))
  );
  const page = await context.newPage();
  await page.goto(hostAddress(baseURL, host, "/exams"));

  await page.getByRole("button", { name: "Create exam" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Exam title" }).fill("PTS Biologi");
  await dialog.getByRole("button", { name: "Create exam" }).click();
  await page.waitForURL(EDITOR_PATH);

  // The exam starts with one question, which takes the four options and the key of the second.
  for (const option of OPTIONS) {
    const field = page.getByRole("textbox", {
      name: `Option ${option.letter}`,
    });
    await field.fill(option.text);
    await field.press("Tab");
  }
  await page.getByRole("radio", { name: "Mark option B as correct" }).click();
  await expect(
    page.getByRole("radio", { name: "Mark option B as correct" })
  ).toBeChecked();

  // The schedule reads the key that the server holds, so the editor opened again waits until
  // the server shows the key before the teacher schedules the sitting.
  const reopened = await context.newPage();
  await reopened.goto(page.url());
  await expect(
    reopened.getByRole("radio", { name: "Mark option B as correct" })
  ).toBeChecked({ timeout: readinessTimeoutMilliseconds });

  await reopened.getByRole("button", { name: "Schedule" }).click();
  const scheduling = reopened.getByRole("dialog");
  await scheduling.getByRole("textbox", { name: "Room" }).fill("Lab 2");
  await scheduling.getByRole("button", { name: "Schedule" }).click();
  await reopened.waitForURL(ROOMS_PATH);
  await context.close();
});

test("a teacher schedules an exam, and its editor opens read-only, saying why", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const host = `${school.slug}.localhost`;
  const context = await browser.newContext();
  await Effect.runPromise(
    signInOwner(context, school.slug, hostAddress(baseURL, host, "/"))
  );
  const page = await context.newPage();
  await page.goto(hostAddress(baseURL, host, "/exams"));

  await page.getByRole("button", { name: "Create exam" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Exam title" }).fill("PTS Fisika");
  await dialog.getByRole("button", { name: "Create exam" }).click();
  await page.waitForURL(EDITOR_PATH);
  const editorUrl = page.url();

  // The exam starts with one question, which takes the four options and the key of the second.
  for (const option of OPTIONS) {
    const field = page.getByRole("textbox", {
      name: `Option ${option.letter}`,
    });
    await field.fill(option.text);
    await field.press("Tab");
  }
  await page.getByRole("radio", { name: "Mark option B as correct" }).click();
  await expect(
    page.getByRole("radio", { name: "Mark option B as correct" })
  ).toBeChecked();

  await page.getByRole("button", { name: "Schedule" }).click();
  const scheduling = page.getByRole("dialog");
  await scheduling.getByRole("textbox", { name: "Room" }).fill("Lab 2");
  await scheduling.getByRole("button", { name: "Schedule" }).click();
  await page.waitForURL(SITTING_PATH);

  // The editor opened again says why its questions are fixed, and offers no change to them.
  await page.goto(editorUrl);
  await expect(
    page.getByText("This exam is scheduled, so its questions are fixed.")
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await expect(page.getByRole("button", { name: "Add question" })).toHaveCount(
    0
  );
  await expect(page.getByRole("button", { name: "More actions" })).toHaveCount(
    0
  );
  await expect(
    page.getByRole("textbox", { name: "Option A" })
  ).not.toBeEditable();
  await expect(
    page.getByRole("radio", { name: "Mark option A as correct" })
  ).toBeDisabled();
  await expect(
    page.getByRole("textbox", { name: "Question text" })
  ).toHaveAttribute("aria-readonly", "true", {
    timeout: readinessTimeoutMilliseconds,
  });

  // The title can still be renamed, and the exam can still be scheduled again.
  await expect(
    page.getByRole("textbox", { name: "Exam title" })
  ).toBeEditable();
  await expect(page.getByRole("button", { name: "Schedule" })).toBeVisible();
  await context.close();
});

test("a question typed long enough for a fold keeps its thumbnail once the teacher moves on", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const host = `${school.slug}.localhost`;
  const context = await browser.newContext();
  await Effect.runPromise(
    signInOwner(context, school.slug, hostAddress(baseURL, host, "/"))
  );
  const page = await context.newPage();
  const changes = await Effect.runPromise(trackChanges(page, []));
  await page.goto(hostAddress(baseURL, host, "/exams"));
  await page.getByRole("button", { name: "Create exam" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Exam title" }).fill("PTS Fisika");
  await dialog.getByRole("button", { name: "Create exam" }).click();
  await page.waitForURL(EDITOR_PATH);

  // The first question gets more steps than a fold waits for, then the teacher adds and
  // writes a second: the first question's thumbnail now reads the server while the fold
  // moves its snapshot, and the page keeps drawing.
  const strip = page.getByRole("navigation", { name: "Questions" });
  const firstPrompt = page.getByRole("textbox", { name: "Question text" });
  await expect(firstPrompt).toBeEditable({
    timeout: readinessTimeoutMilliseconds,
  });
  await firstPrompt.click();
  const sentBefore = changes.sent;
  await page.keyboard.type(LONG_PROMPT);
  // The page sends its changes one after another, so the server takes the first
  // question's steps before the teacher moves on, as a teacher typing at a person's pace
  // leaves it, and the second question is not created behind a queue of saves.
  await saved(changes, sentBefore);
  await page.getByRole("button", { name: "Add question" }).click();
  await expect(page.getByRole("heading", { name: "Question 2" })).toBeVisible();
  const secondPrompt = page.getByRole("textbox", { name: "Question text" });
  await expect(secondPrompt).toBeEditable({
    timeout: readinessTimeoutMilliseconds,
  });
  await secondPrompt.click();
  await page.keyboard.type("Berapa hasil 3 + 4?");
  await expect(
    strip.getByRole("button", { name: FIRST_QUESTION })
  ).toContainText(LONG_PROMPT, { timeout: readinessTimeoutMilliseconds });
  await expect(secondPrompt).toContainText("Berapa hasil 3 + 4?");
  await context.close();
});
