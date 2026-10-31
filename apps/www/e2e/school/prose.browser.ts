import {
  type Browser,
  expect,
  type Locator,
  type Page,
  test,
} from "@playwright/test";
import { Array as Arr, Effect, Record as Rec } from "effect";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { runFirstSection } from "@/e2e/support/player";
import {
  createSchool,
  hostAddress,
  inviteLearner,
  seedSitting,
  signInOwner,
} from "@/e2e/support/school";
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
 * lesson's article and a try-out question, which draw their documents with the same parts, and an exam
 * document, which the exam editor and the student's sitting share. A link is read straight inside a
 * paragraph, since a link inside a marked phrase takes its colour.
 */
const KINDS: Readonly<
  Record<string, Readonly<Record<"document" | "lesson", string>>>
> = {
  bold: {
    document: "p strong",
    lesson: "p strong",
  },
  cell: {
    document: "td",
    lesson: "td",
  },
  code: {
    document: "p code",
    lesson: "p code",
  },
  heading: {
    document: "h2",
    lesson: "h2",
  },
  link: {
    document: "p > a",
    lesson: "p > a[href]",
  },
  listItem: {
    document: "ul > li",
    lesson: "ul > li",
  },
  paragraph: {
    document: "p:not(li p, td p, th p, blockquote p)",
    lesson: "p:not(li p, td p, th p, blockquote p)",
  },
  quote: {
    document: "blockquote",
    lesson: "blockquote",
  },
  tableFrame: {
    document: ".tableWrapper",
    lesson: '[data-slot="table-container"]',
  },
  tableHead: {
    document: "th",
    lesson: "th",
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

/**
 * The look of the first element the selector finds inside `root`, or nothing when it finds none. A
 * heading is read at the element that holds its first words, where its colour and its rule are: a
 * lesson's heading holds them in a span inside its link, beside the link's icon, and an exam
 * document's holds them itself.
 */
async function lookIn(root: Locator, selector: string) {
  const element = root.locator(selector).first();
  if ((await element.count()) === 0) {
    return;
  }
  await element.scrollIntoViewIfNeeded();
  return element.evaluate(
    (node, names) => {
      // A heading is read at the element of its first words: a lesson's sits in its link beside the link's icon.
      const words = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
        acceptNode: (text) =>
          (text.textContent ?? "").trim() === ""
            ? NodeFilter.FILTER_SKIP
            : NodeFilter.FILTER_ACCEPT,
      });
      const first = node.matches("h1, h2, h3") ? words.nextNode() : null;
      const target = first?.parentElement ?? node;
      const style = getComputedStyle(target);
      return Object.fromEntries(
        names.map((name) => [name, style.getPropertyValue(name)])
      );
    },
    [...LOOK]
  );
}

/** The look of every kind inside `root`, by the selector that surface uses. */
async function looksIn(root: Locator, side: "document" | "lesson") {
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
  const editorInset = await insetOf(editorPrompt);

  // The teacher's preview, Try as student, reads the exam the way its student does.
  await owner.goto(address(`/exams/${sitting.examId}/try`));
  const previewPrompt = owner
    .getByRole("article", { exact: true, name: "Question 3" })
    .locator('[data-slot="sitting-document"]')
    .first();
  await expect(previewPrompt).toContainText("Soal ketiga", {
    timeout: readinessTimeoutMilliseconds,
  });
  const preview = await looksIn(previewPrompt, "document");
  const previewInset = await insetOf(previewPrompt);

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
    .getByRole("article", { exact: true, name: "Question 3" })
    .locator('[data-slot="sitting-document"]')
    .first();
  await expect(sittingPrompt).toContainText("Soal ketiga", {
    timeout: readinessTimeoutMilliseconds,
  });
  const reader = await looksIn(sittingPrompt, "document");
  const sittingInset = await insetOf(sittingPrompt);

  await Promise.all([studentContext.close(), ownerContext.close()]);
  return {
    insets: {
      editor: editorInset,
      preview: previewInset,
      sitting: sittingInset,
    },
    looks: { editor, preview, sitting: reader },
  };
}

/**
 * How far a document draws its first block inside its own box, as `left,top` in pixels: zero for a document that
 * draws flush, so the card or the paper around it alone gives the text its room, as a try-out question's does.
 */
function insetOf(document: Locator) {
  return document.evaluate((node) => {
    const box = node.getBoundingClientRect();
    const first = node.firstElementChild?.getBoundingClientRect();
    if (first === undefined) {
      return "empty";
    }
    const left = Math.round(first.left - box.left - node.clientLeft);
    const top = Math.round(first.top - box.top - node.clientTop);
    return `${left},${top}`;
  });
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

/** The look of each kind in the lessons: the first article that holds a kind gives its look. */
async function lessonLooks(page: Page) {
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
  return lesson;
}

/** How one surface draws one kind unlike the lesson: the properties that differ, or that it is missing. */
function diffOf(
  surface: string,
  reference: Record<string, string>,
  look: Record<string, string> | undefined
) {
  if (look !== undefined) {
    return differences(reference, look);
  }
  return surface === "tryout" ? [] : ["missing"];
}

/**
 * Each kind a surface draws unlike the lesson, by surface, with the properties that differ. The exam
 * fixture holds every kind, so a kind it lacks is reported missing; a try-out question holds only the
 * kinds its content does, so a kind it lacks is not compared.
 */
function reportOf(
  lesson: Record<string, Record<string, string>>,
  surfaces: Record<string, Record<string, Record<string, string>>>
) {
  const report: Record<string, Record<string, readonly string[]>> = {};
  for (const [name, reference] of Rec.toEntries(lesson)) {
    for (const [surface, looks] of Rec.toEntries(surfaces)) {
      const diff = diffOf(surface, reference, looks[name]);
      if (diff.length > 0) {
        report[name] = { ...report[name], [surface]: diff };
      }
    }
  }
  return report;
}

test.describe("Content looks alike on every surface", () => {
  test.use({ viewport: { height: 900, width: 1280 } });

  test("draws each block and mark of a lesson the same, and flush in its card, in a try-out question, the exam editor, the teacher's preview and the sitting", async ({
    baseURL,
    browser,
    page,
  }) => {
    test.setTimeout(6 * 60_000);

    const lesson = await lessonLooks(page);

    // A try-out question: the documents of the first section, its readings and its prompts, which hold
    // the kinds the acceptance content gives them.
    await Effect.runPromise(runFirstSection(page, false, baseURL ?? ""));
    const documents = page.locator(
      'section[aria-label="Question"], section[aria-label="Reading"]'
    );
    await expect(documents.first()).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    const tryout = await looksIn(documents, "lesson");
    const tryoutInset = await insetOf(documents.first());
    expect(
      tryout.paragraph,
      "a try-out question draws paragraphs"
    ).toBeDefined();

    const exam = await documentLooks(browser, baseURL);
    const surfaces = { tryout, ...exam.looks };

    // Every document draws its first block flush in its own box: the card around it gives the room. The check is
    // soft, so a run reports the look of every kind below as well.
    expect
      .soft(
        { tryout: tryoutInset, ...exam.insets },
        "each document's first block, as left,top inside its box"
      )
      .toEqual({
        editor: "0,0",
        preview: "0,0",
        sitting: "0,0",
        tryout: "0,0",
      });

    // The report names each kind that differs, each surface where it does, and each property with
    // the lesson's value and that surface's; a kind no lesson holds is not compared.
    expect(
      reportOf(lesson, surfaces),
      `the lessons hold ${Arr.join(Rec.keys(lesson), ", ")}`
    ).toEqual({});
  });
});
