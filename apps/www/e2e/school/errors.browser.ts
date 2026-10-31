import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { expect, test } from "@playwright/test";
import { Array as Arr, Effect, FileSystem, Path, Schema } from "effect";

/**
 * The narrowest field of the School: one in a drawer on a 320px phone, the screen less the drawer
 * panel's 24px padding on each side.
 */
const NARROWEST_FIELD = 272;

/** The languages the School speaks. */
const LOCALES = ["en", "id", "de"] as const;

/** A field's error line and what it holds, up to the line's close. */
const FIELD_ERROR = /<FieldError\b[^>]*>([\s\S]*?)<\/FieldError>/g;

/** The namespace a component reads its words from. */
const TRANSLATOR = /useTranslations\(\s*"([A-Za-z]+)"\s*\)/g;

/** A string literal that may name a message. */
const LITERAL = /"([a-z][a-z0-9-]*)"/g;

/** A simple placeholder of a message, by its name. */
const PLACEHOLDER = /\{([A-Za-z]+)\}/g;

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
  line.className = "min-h-5 font-normal text-destructive text-sm";
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
