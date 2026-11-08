import { expect, type Locator, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import {
  createSchool,
  grantStudent,
  hostAddress,
  inviteLearner,
  seedSitting,
  signInOwner,
} from "@/e2e/support/school";
import { expectSymmetric } from "@/e2e/support/symmetry";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** How long one width may take: a school, a seeded exam of every template, its editor and its try. */
const WIDTH_MILLISECONDS = 8 * 60 * 1000;

/** The widths a teacher and a student bring: two phones, a tablet, and a laptop. */
const WIDTHS = [320, 390, 768, 1440] as const;

/** Words long enough to wrap in every column at every width, so a marker meets more than one line. */
const LONG =
  "Pernyataan yang sengaja ditulis sangat panjang agar barisnya terlipat menjadi beberapa baris di setiap lebar layar";

/** The dot of the matching's second statement, whatever it is joined to. */
const SECOND_STATEMENT = /^Statement 2, /u;

/** The quiet period of an option's save, with room for the server's answer. */
const SAVED_MILLISECONDS = 2500;

/** The question of the seeded exam that holds each answer type, by its number on the paper. */
const QUESTIONS = {
  choice: 1,
  match: 8,
  table: 9,
} as const;

/** One question's page of the editor, by its number, and none of the questions whose number starts with it. */
const pageOf = (page: Page, number: number) =>
  page.getByRole("region", { exact: true, name: `Question ${number}` });

/**
 * Writes words into one rich text of the editor, in place of what it held; no words leaves it empty. The canvas mounts
 * a page's editors only near the view, so the page comes into view first and its text is awaited.
 */
async function rewrite(page: Page, editor: Locator, words: string) {
  await editor.scrollIntoViewIfNeeded({
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(editor).toBeEditable({ timeout: readinessTimeoutMilliseconds });
  await editor.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Backspace");
  if (words !== "") {
    await page.keyboard.type(words);
  }
}

/**
 * Measures one question in each state its parts take, hovered, focused from the keyboard, in hand and under a pull,
 * and saves its picture in each, since a ring or a control that shows only then can cover another.
 */
async function measureStates(
  page: Page,
  question: Locator,
  name: string,
  states: readonly {
    readonly enter: () => Promise<void>;
    readonly leave?: () => Promise<void>;
    readonly state: string;
  }[]
) {
  for (const { enter, leave, state } of states) {
    await enter();
    await expectSymmetric(page, `${name} ${state}`, '[data-page=""]');
    await question.screenshot({
      path: test.info().outputPath(`${name}-${state}.png`),
    });
    await leave?.();
  }
}

/** Saves a picture of every question of a surface, for the eye that reads what a measure cannot. */
async function photograph(questions: Locator, name: string) {
  const count = await questions.count();
  for (let index = 0; index < count; index += 1) {
    const question = questions.nth(index);
    await question.scrollIntoViewIfNeeded();
    await question.screenshot({
      path: test.info().outputPath(`${name}-${index + 1}.png`),
    });
  }
}

test.describe.configure({ mode: "parallel" });

for (const width of WIDTHS) {
  test(`every answer type stands on one axis in the editor and on the paper at ${width}`, async ({
    baseURL,
    browser,
  }) => {
    test.setTimeout(WIDTH_MILLISECONDS);
    const school = await Effect.runPromise(createSchool());
    const host = `${school.slug}.localhost`;
    const home = hostAddress(baseURL, host, "/");
    const viewport = { height: 900, width };
    const owner = await browser.newContext({ viewport });
    const student = await browser.newContext({ viewport });
    await Effect.runPromise(signInOwner(owner, school.slug, home));
    const learner = `symmetry-${school.slug}@acceptance.example.test`;
    await Effect.runPromise(
      inviteLearner({
        address: learner,
        baseURL: home,
        context: student,
        slug: school.slug,
      })
    );
    await Effect.runPromise(grantStudent(school.slug, learner));
    const { examId } = await Effect.runPromise(
      seedSitting(school.slug, learner, 0, "templates")
    );

    // The worst case: a part whose words wrap, and a part with none, which shows its hint.
    const page = await owner.newPage();
    await page.goto(hostAddress(baseURL, host, `/exams/${examId}/edit`));
    const prompt = page.getByRole("textbox", { name: "Question 1 text" });
    await expect(prompt).toBeEditable({
      timeout: readinessTimeoutMilliseconds,
    });
    const editors = {
      answer: page.getByRole("textbox", {
        name: `Question ${QUESTIONS.match}, answer A`,
      }),
      choice: page.getByRole("textbox", {
        name: `Question ${QUESTIONS.choice}, option A`,
      }),
      empty: page.getByRole("textbox", {
        name: `Question ${QUESTIONS.match}, statement 2`,
      }),
      emptyChoice: page.getByRole("textbox", {
        name: `Question ${QUESTIONS.choice}, option B`,
      }),
      statement: page.getByRole("textbox", {
        name: `Question ${QUESTIONS.match}, statement 1`,
      }),
      table: page.getByRole("textbox", {
        name: `Question ${QUESTIONS.table}, statement 1`,
      }),
    };
    await rewrite(page, editors.choice, LONG);
    await rewrite(page, editors.emptyChoice, "");
    await pageOf(page, QUESTIONS.match).scrollIntoViewIfNeeded();
    await rewrite(page, editors.statement, LONG);
    await rewrite(page, editors.answer, LONG);
    await rewrite(page, editors.empty, "");
    await pageOf(page, QUESTIONS.table).scrollIntoViewIfNeeded();
    await rewrite(page, editors.table, LONG);
    await page.waitForTimeout(SAVED_MILLISECONDS);

    await expectSymmetric(page, `editor at ${width}`, '[data-page=""]');
    await expectSymmetric(
      page,
      `teacher's layer at ${width}`,
      '[aria-label="For teachers"]'
    );
    await photograph(page.locator('[data-page=""]'), `editor-${width}`);

    // Every state of the matching's parts, then of an option and of a table's statement.
    const matching = pageOf(page, QUESTIONS.match);
    const statementDot = matching.getByRole("button", {
      name: "Statement 1, joined to B",
    });
    const secondDot = matching.getByRole("button", {
      name: SECOND_STATEMENT,
    });
    const answerRow = matching.locator("[data-line-target]").first();
    await matching.scrollIntoViewIfNeeded();
    await expect(statementDot).toBeEnabled({
      timeout: readinessTimeoutMilliseconds,
    });
    await measureStates(page, matching, `matching-${width}`, [
      { enter: () => editors.statement.hover(), state: "hover" },
      {
        enter: async () => {
          await secondDot.focus();
          await page.keyboard.press("ArrowUp");
        },
        state: "focus",
      },
      {
        enter: () => statementDot.click(),
        leave: () => page.keyboard.press("Escape"),
        state: "held",
      },
      {
        enter: async () => {
          const from = await secondDot.boundingBox();
          const to = await answerRow.boundingBox();
          if (from === null || to === null) {
            return;
          }
          await page.mouse.move(
            from.x + from.width / 2,
            from.y + from.height / 2
          );
          await page.mouse.down();
          await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
            steps: 8,
          });
        },
        leave: () => page.mouse.up(),
        state: "drag",
      },
    ]);
    const choice = pageOf(page, QUESTIONS.choice);
    await choice.scrollIntoViewIfNeeded();
    await expect(editors.choice).toBeEditable({
      timeout: readinessTimeoutMilliseconds,
    });
    await measureStates(page, choice, `choice-${width}`, [
      { enter: () => editors.choice.hover(), state: "hover" },
      {
        enter: async () => {
          await editors.choice.click();
          await page.keyboard.press("Tab");
        },
        state: "focus",
      },
    ]);
    const table = pageOf(page, QUESTIONS.table);
    await table.scrollIntoViewIfNeeded();
    await expect(editors.table).toBeEditable({
      timeout: readinessTimeoutMilliseconds,
    });
    await measureStates(page, table, `table-${width}`, [
      { enter: () => editors.table.hover(), state: "hover" },
    ]);

    // The student's paper draws the same parts through the player.
    const paper = await owner.newPage();
    await paper.goto(hostAddress(baseURL, host, `/exams/${examId}/try`));
    const first = paper.getByRole("article", {
      exact: true,
      name: "Question 1",
    });
    await expect(first).toBeVisible({ timeout: readinessTimeoutMilliseconds });
    await expectSymmetric(paper, `paper at ${width}`, "article");
    await photograph(paper.getByRole("article"), `paper-${width}`);
  });
}
