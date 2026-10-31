import { type Browser, expect, type Locator, test } from "@playwright/test";
import { Array as Arr, Effect, Record as Rec } from "effect";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { answerMessage, learnerMessage } from "@/e2e/support/prose";
import {
  createSchool,
  hostAddress,
  inviteLearner,
  seedSitting,
  signInOwner,
} from "@/e2e/support/school";
import { BUBBLE_CONTENT } from "@/e2e/support/selector";
import { openServedChat, rowOf } from "@/e2e/support/serve";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/**
 * The computed properties that make two elements look alike: their words, their surface and their
 * edges. Margins are left out, since the first and the last block of any surface drop theirs.
 */
const LOOK = [
  "font-size",
  "line-height",
  "font-weight",
  "font-style",
  "letter-spacing",
  "color",
  "background-color",
  "border-top-width",
  "border-top-style",
  "border-top-color",
  "border-top-left-radius",
  "padding-top",
  "padding-inline-start",
  "text-decoration-line",
  "text-underline-offset",
] as const;

/**
 * Every kind the fixture holds once, by its name in the report, and where each surface draws it: a
 * lesson's article (the published MDX path), a Markdown answer (the path a try-out's text and Nina's
 * answers share), and an exam document (which the exam editor and the student's sitting share). A
 * link is read straight inside a paragraph, since a link inside a marked phrase takes its colour.
 */
const KINDS: Readonly<
  Record<string, Readonly<Record<"document" | "lesson" | "markdown", string>>>
> = {
  bold: {
    document: "p strong",
    lesson: "p strong",
    markdown: '[data-nakafa="paragraph"] [data-nakafa="bold"]',
  },
  cell: {
    document: "td",
    lesson: "td",
    markdown: '[data-nakafa="table-cell"]',
  },
  code: {
    document: "p code",
    lesson: "p code",
    markdown: '[data-nakafa="paragraph"] code',
  },
  heading: {
    document: "h2",
    lesson: "h2",
    markdown: '[data-nakafa="heading-2"]',
  },
  link: {
    document: "p > a",
    lesson: "p > a[href]",
    markdown: '[data-nakafa="paragraph"] > a[data-nakafa="anchor"]',
  },
  listItem: {
    document: "ul > li",
    lesson: "ul > li",
    markdown: 'ul > [data-nakafa="list-item"]',
  },
  paragraph: {
    document: "p:not(li p, td p, th p, blockquote p)",
    lesson: "p:not(li p, td p, th p, blockquote p)",
    markdown: '[data-nakafa="paragraph"]:not(li *, td *, th *, blockquote *)',
  },
  quote: {
    document: "blockquote",
    lesson: "blockquote",
    markdown: '[data-nakafa="quote"]',
  },
  tableFrame: {
    document: ".tableWrapper",
    lesson: '[data-slot="table-container"]',
    markdown: '[data-slot="table-container"]',
  },
  tableHead: {
    document: "th",
    lesson: "th",
    markdown: '[data-nakafa="table-head"]',
  },
};

/** The lessons the acceptance content serves, read in this order until every kind is found. */
const LESSONS = [
  pinnedRoutes.exponent.en,
  pinnedRoutes.growth.en,
  pinnedRoutes.inverse.en,
  pinnedRoutes.material.en,
  pinnedRoutes.relative.en,
  pinnedRoutes.article.en,
  pinnedRoutes.cabinet.en,
];

/** The prose question's prompt as Markdown: the same blocks and marks as the seed's exam document. */
const MARKDOWN = Arr.join(
  [
    "## Soal ketiga",
    "",
    "Bacalah **kata penting**, buka [tautan](https://nakafa.com), tulis `x + 1`, lalu baca.",
    "",
    "- Butir pertama",
    "- Butir kedua",
    "",
    "1. Langkah pertama",
    "2. Langkah kedua",
    "",
    "> Kutipan yang dibaca.",
    "",
    "| Zat | Titik didih |",
    "| --- | --- |",
    "| Air | 100 °C |",
  ],
  "\n"
);

/**
 * The look of the first element the selector finds inside `root`, or nothing when it finds none. A
 * heading whose words sit in one span of their own, as a lesson's do, is read at that span, where
 * its colour and its rule are.
 */
async function lookIn(root: Locator, selector: string) {
  const element = root.locator(selector).first();
  if ((await element.count()) === 0) {
    return;
  }
  await element.scrollIntoViewIfNeeded();
  return element.evaluate(
    (node, names) => {
      const only = node.children.length === 1 ? node.children[0] : null;
      const target =
        node.matches("h1, h2, h3") && only?.tagName === "SPAN" ? only : node;
      const style = getComputedStyle(target);
      return Object.fromEntries(
        names.map((name) => [name, style.getPropertyValue(name)])
      );
    },
    [...LOOK]
  );
}

/** The look of every kind inside `root`, by the selector that surface uses. */
async function looksIn(
  root: Locator,
  side: "document" | "lesson" | "markdown"
) {
  const looks: Record<string, Record<string, string>> = {};
  for (const [name, kind] of Rec.toEntries(KINDS)) {
    const look = await lookIn(root, kind[side]);
    if (look !== undefined) {
      looks[name] = look;
    }
  }
  return looks;
}

/**
 * The prompt of the prose question in the exam editor and in the student's sitting, in one school
 * that a fresh owner and a fresh student share.
 */
async function documentLooks(browser: Browser, baseURL: string | undefined) {
  const school = await Effect.runPromise(createSchool());
  const host = `${school.slug}.localhost`;
  const address = (path: string) => hostAddress(baseURL, host, path);
  const learner = `student-${school.slug}@acceptance.example.test`;
  const studentContext = await browser.newContext();
  await Effect.runPromise(
    inviteLearner({
      address: learner,
      baseURL: address("/"),
      context: studentContext,
      slug: school.slug,
    })
  );
  const ownerContext = await browser.newContext();
  await Effect.runPromise(signInOwner(ownerContext, school.slug, address("/")));
  const sitting = await Effect.runPromise(
    seedSitting(school.slug, learner, 0, "prose")
  );

  const owner = await ownerContext.newPage();
  await owner.goto(address(`/exams/${sitting.examId}/edit`));
  const editorPrompt = owner.getByRole("textbox", { name: "Question 3 text" });
  await expect(editorPrompt).toContainText("Soal ketiga", {
    timeout: readinessTimeoutMilliseconds,
  });
  const editor = await looksIn(editorPrompt, "document");

  const student = await studentContext.newPage();
  await student.goto(address(`/sittings/${sitting.sittingId}`));
  await waitUntilTakenOver(
    student.getByRole("button", { name: "Enter sitting" })
  );
  await student
    .getByPlaceholder("Enter the token from your proctor")
    .fill(sitting.token);
  await student.getByRole("button", { name: "Enter sitting" }).click();
  const sittingPrompt = student
    .getByRole("textbox", { name: "Question text" })
    .nth(2);
  await expect(sittingPrompt).toContainText("Soal ketiga", {
    timeout: readinessTimeoutMilliseconds,
  });
  const reader = await looksIn(sittingPrompt, "document");

  await Promise.all([studentContext.close(), ownerContext.close()]);
  return { editor, sitting: reader };
}

/** The properties of `look` that differ from `reference`, each as the lesson's value and this surface's. */
function differences(
  reference: Record<string, string>,
  look: Record<string, string>
) {
  return Arr.flatMap(LOOK, (name) =>
    reference[name] === look[name]
      ? []
      : [`${name}: ${reference[name]} | ${look[name]}`]
  );
}

test.describe("Content looks alike on every surface", () => {
  test.use({ viewport: { height: 900, width: 1280 } });

  test("draws each block and mark of a lesson the same in a Markdown answer, the exam editor and the sitting", async ({
    baseURL,
    browser,
    page,
  }) => {
    test.setTimeout(6 * 60_000);

    // The lesson: the first article that holds each kind gives its look.
    const lesson: Record<string, Record<string, string>> = {};
    for (const path of LESSONS) {
      await page.goto(path);
      const article = page.locator("main article").first();
      await expect(article).toBeVisible({
        timeout: readinessTimeoutMilliseconds,
      });
      for (const [name, look] of Rec.toEntries(
        await looksIn(article, "lesson")
      )) {
        lesson[name] ??= look;
      }
    }

    // A Markdown answer of the same blocks and marks.
    const question = learnerMessage({ order: 1, text: "Pertanyaan 1" });
    const answer = answerMessage({ markdown: MARKDOWN, order: 1 });
    await Effect.runPromise(
      openServedChat(page, baseURL ?? "", [question, answer])
    );
    const bubble = rowOf(page, answer).locator(BUBBLE_CONTENT);
    await expect(bubble).toContainText("Soal ketiga", {
      timeout: readinessTimeoutMilliseconds,
    });
    const markdown = await looksIn(bubble, "markdown");

    const exam = await documentLooks(browser, baseURL);
    const surfaces = { markdown, ...exam };

    // Every surface draws each kind it holds with the lesson's look.
    const report: Record<string, Record<string, readonly string[]>> = {};
    for (const [name, reference] of Rec.toEntries(lesson)) {
      for (const [surface, looks] of Rec.toEntries(surfaces)) {
        const look = looks[name];
        const missing = look === undefined;
        const diff = missing ? ["missing"] : differences(reference, look);
        if (diff.length > 0) {
          report[name] = { ...report[name], [surface]: diff };
        }
      }
    }
    // The report names each kind that differs, each surface where it does, and each property with
    // the lesson's value and that surface's; a kind no lesson holds is not compared.
    expect(
      report,
      `the lessons hold ${Arr.join(Rec.keys(lesson), ", ")}`
    ).toEqual({});
  });
});
