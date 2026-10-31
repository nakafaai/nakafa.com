import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { expect, test } from "@playwright/test";
import { EXAM_TITLE_MAX_LENGTH } from "@repo/backend/confect/exams/exam";
import { Array as Arr, Effect, FileSystem, Path, Schema } from "effect";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { waitUntilTakenOver } from "@/e2e/support/window";

/**
 * The narrowest field of the School: one in a drawer on a 320px phone, the screen less the drawer
 * panel's 24px padding on each side.
 */
const NARROWEST_FIELD = 272;

/** The languages the School speaks. */
const LOCALES = ["en", "id", "de"] as const;

/** A field's error line and what it holds, up to the line's close. */
const FIELD_ERROR = /<FieldError\b[^>]*>(?<content>[\s\S]*?)<\/FieldError>/gu;

/** The namespace a component reads its words from. */
const TRANSLATOR = /useTranslations\(\s*"(?<namespace>[A-Za-z]+)"\s*\)/gu;

/** A string literal that may name a message. */
const LITERAL = /"(?<key>[a-z][a-z0-9-]*)"/gu;

/** A simple placeholder of a message, by its name. */
const PLACEHOLDER = /\{(?<name>[A-Za-z]+)\}/gu;

/**
 * What fills a placeholder: a count takes 200, three digits, as wide as the largest limit a School field
 * states, and any other placeholder a sample name.
 */
const sampleOf = (name: string) => (name === "count" ? "200" : "Siswa Uji");

/** A dictionary: namespaces of messages, where a message may also be a nested group. */
const Dictionary = Schema.fromJsonString(
  Schema.Record(Schema.String, Schema.Record(Schema.String, Schema.Unknown))
);

/** One message a School field may show in its error line. */
const FieldMessage = Schema.Struct({
  key: Schema.String,
  namespace: Schema.String,
});

/**
 * The messages the School's fields show in their error lines: every literal inside a `<FieldError>` of a
 * School component that names a message in one of that component's namespaces.
 */
const readFieldMessages = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const www = path.resolve(import.meta.dirname, "../..");
  const sources = path.join(www, "src/components/tenant");
  const dictionaries = path.resolve(
    www,
    "../../packages/internationalization/dictionaries"
  );
  const english = yield* fs
    .readFileString(path.join(dictionaries, "en.json"))
    .pipe(Effect.flatMap(Schema.decodeEffect(Dictionary)));
  const files = Arr.filter(
    yield* fs.readDirectory(sources, { recursive: true }),
    (file) => file.endsWith(".tsx")
  );
  const found = yield* Effect.forEach(files, (file) =>
    Effect.map(fs.readFileString(path.join(sources, file)), (source) => {
      const namespaces = Arr.map(
        Arr.fromIterable(source.matchAll(TRANSLATOR)),
        (match) => match[1] ?? ""
      );
      return Arr.flatMap(
        Arr.fromIterable(source.matchAll(FIELD_ERROR)),
        (block) =>
          Arr.flatMap(
            Arr.fromIterable((block[1] ?? "").matchAll(LITERAL)),
            (literal) =>
              Arr.flatMap(namespaces, (namespace) => {
                const key = literal[1] ?? "";
                return typeof english[namespace]?.[key] === "string"
                  ? [FieldMessage.make({ key, namespace })]
                  : [];
              })
          )
      );
    })
  );
  const messages = Arr.dedupeWith(
    Arr.flatten(found),
    (a, b) => a.key === b.key && a.namespace === b.namespace
  );
  const texts = yield* Effect.forEach(LOCALES, (locale) =>
    Effect.map(
      fs
        .readFileString(path.join(dictionaries, `${locale}.json`))
        .pipe(Effect.flatMap(Schema.decodeEffect(Dictionary))),
      (dictionary) =>
        Arr.flatMap(messages, (message) => {
          const text = dictionary[message.namespace]?.[message.key];
          if (typeof text !== "string") {
            return [];
          }
          const filled = text.replace(PLACEHOLDER, (_, name: string) =>
            sampleOf(name)
          );
          // A plural or select message holds no single line to measure.
          return filled.includes("{")
            ? []
            : [
                {
                  label: `${locale} ${message.namespace}.${message.key}`,
                  text: filled,
                },
              ];
        })
    )
  );
  return Arr.flatten(texts);
}).pipe(Effect.provide(nodeServicesLayer));

/**
 * The texts that take more than one line in a field's error line at `width`: the line is drawn with the
 * classes `FieldError` draws it with, in the page's own face.
 */
function overflowing({
  texts,
  width,
}: {
  texts: readonly { label: string; text: string }[];
  width: number;
}) {
  const line = document.createElement("div");
  line.className = "font-normal leading-normal text-destructive text-sm";
  line.style.width = `${width}px`;
  document.body.append(line);
  const long = texts.filter((entry) => {
    line.textContent = entry.text;
    const range = document.createRange();
    range.selectNodeContents(line);
    const tops = new Set(
      Array.from(range.getClientRects(), (rect) => Math.round(rect.top))
    );
    return tops.size > 1;
  });
  line.remove();
  return long.map((entry) => `${entry.label}: ${entry.text}`);
}

/** A field's height, and how far down it the line under its control starts: its error, or else its description. */
function lineOf(field: Element) {
  const line = Array.from(
    field.querySelectorAll(
      '[data-slot="field-description"], [data-slot="field-error"]'
    )
  ).find((part) => part.getBoundingClientRect().height > 0);
  const box = field.getBoundingClientRect();
  return {
    height: box.height,
    top: (line?.getBoundingClientRect().top ?? box.top) - box.top,
  };
}

test("a field typed past its limit keeps its height, with the error on its description's line", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const host = `${school.slug}.localhost`;
  const context = await browser.newContext({
    viewport: { height: 860, width: 320 },
  });
  await Effect.runPromise(
    signInOwner(context, school.slug, hostAddress(baseURL, host, "/"))
  );
  const page = await context.newPage();
  await page.goto(hostAddress(baseURL, host, "/exams"));
  const create = page.getByRole("button", { name: "Create exam" }).first();
  await waitUntilTakenOver(create);
  await create.click();
  const field = page.getByRole("dialog").locator('[data-slot="field"]').first();
  const description = field.locator('[data-slot="field-description"]');
  await expect(description).toBeVisible();
  await expect(field.locator('[data-slot="field-error"]')).toBeHidden();

  const idle = await field.evaluate(lineOf);
  await field.getByRole("textbox").fill("a".repeat(EXAM_TITLE_MAX_LENGTH + 1));
  await expect(field.getByRole("alert")).toBeVisible();
  await expect(description).toBeHidden();
  expect(await field.evaluate(lineOf)).toEqual(idle);
});

test("every School field's error fits its one line in every language at the narrowest field", async ({
  page,
}) => {
  const texts = await Effect.runPromise(readFieldMessages);
  expect(texts.length).toBeGreaterThan(0);
  await page.goto("/en");
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(overflowing, { texts, width: NARROWEST_FIELD })
  ).toEqual([]);
});
