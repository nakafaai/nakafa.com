import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { Array as Arr, Effect, FileSystem, Path, Schema } from "effect";
import { readPlaceholder } from "@/e2e/support/placeholder";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The languages the School speaks. */
const LOCALES = ["en", "id", "de"] as const;

/** A search field that names its placeholder by a literal message: a table page's search box or a palette's. */
const SEARCH_FIELD =
  /<(?<field>TableSearch|CommandInput)\b[^>]*?placeholder=\{(?<translator>t[A-Za-z]*)\("(?<key>[a-z0-9-]+)"\)\}/gu;

/** A translator a component binds to its namespace. */
const TRANSLATOR =
  /const (?<name>t[A-Za-z]*) = useTranslations\(\s*"(?<namespace>[A-Za-z]+)"\s*\)/gu;

/** A dictionary: namespaces of messages, where a message may also be a nested group. */
const Dictionary = Schema.fromJsonString(
  Schema.Record(Schema.String, Schema.Record(Schema.String, Schema.Unknown))
);

/** One placeholder of a search field in one language: the field that shows it, where its message lives, and its text. */
const SearchPlaceholder = Schema.Struct({
  field: Schema.String,
  label: Schema.String,
  text: Schema.String,
});

/**
 * The placeholders of the app's search fields, in every language, by the field that shows them: every literal
 * message a `<TableSearch>` or a `<CommandInput>` of the app names, in the namespace its translator reads.
 */
const readSearchPlaceholders = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const www = path.resolve(import.meta.dirname, "../..");
  const sources = path.join(www, "src/components");
  const dictionaries = path.resolve(
    www,
    "../../packages/internationalization/dictionaries"
  );
  const files = Arr.filter(
    yield* fs.readDirectory(sources, { recursive: true }),
    (file) => file.endsWith(".tsx")
  );
  const fields = Arr.flatten(
    yield* Effect.forEach(files, (file) =>
      Effect.map(fs.readFileString(path.join(sources, file)), (source) => {
        const translators = Arr.map(
          Arr.fromIterable(source.matchAll(TRANSLATOR)),
          (match) => ({
            name: match.groups?.name ?? "",
            namespace: match.groups?.namespace ?? "",
          })
        );
        return Arr.flatMap(
          Arr.fromIterable(source.matchAll(SEARCH_FIELD)),
          (match) =>
            Arr.flatMap(translators, (translator) =>
              translator.name === match.groups?.translator
                ? [
                    {
                      field: match.groups?.field ?? "",
                      key: match.groups?.key ?? "",
                      namespace: translator.namespace,
                    },
                  ]
                : []
            )
        );
      })
    )
  );
  const texts = yield* Effect.forEach(LOCALES, (locale) =>
    Effect.map(
      fs
        .readFileString(path.join(dictionaries, `${locale}.json`))
        .pipe(Effect.flatMap(Schema.decodeEffect(Dictionary))),
      (dictionary) =>
        Arr.flatMap(fields, (field) => {
          const text = dictionary[field.namespace]?.[field.key];
          return typeof text === "string"
            ? [
                SearchPlaceholder.make({
                  field: field.field,
                  label: `${locale} ${field.namespace}.${field.key}`,
                  text,
                }),
              ]
            : [];
        })
    )
  );
  return Arr.dedupeWith(
    Arr.flatten(texts),
    (a, b) => a.field === b.field && a.label === b.label
  );
}).pipe(Effect.provide(nodeServicesLayer));

/**
 * The placeholders of `texts` that the field at `selector` cuts: each one is shown in the field in turn and read
 * from the box the browser draws it in, as the label and how far its text runs past the room.
 */
const cutPlaceholders = Effect.fn("NakafaE2E.cutPlaceholders")(function* (
  page: Page,
  selector: string,
  texts: readonly (typeof SearchPlaceholder.Type)[]
) {
  const cut = yield* Effect.forEach(texts, (entry) =>
    Effect.gen(function* () {
      yield* Effect.promise(() =>
        page.evaluate(
          ({ field, text }) =>
            document.querySelector(field)?.setAttribute("placeholder", text),
          { field: selector, text: entry.text }
        )
      );
      const placeholder = yield* readPlaceholder(page, selector);
      return placeholder.overflow > 0
        ? [
            `${entry.label} "${entry.text}" runs ${placeholder.overflow}px past ${placeholder.room}px`,
          ]
        : [];
    })
  );
  return Arr.flatten(cut);
});

/** The design system's text fields in a part of the page that show no hint of what to write. */
const unhinted = (part: Locator) =>
  part.locator(
    '[data-slot="input"]:not([placeholder]), [data-slot="textarea"]:not([placeholder])'
  );

test("every School text field shows what to write: the card sign-in, the invite and the profile", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);

  const visitor = await browser.newContext();
  const entry = await visitor.newPage();
  await entry.goto(address("/?sign-in=username"));
  await waitUntilTakenOver(entry.getByRole("button", { name: "Sign in" }));
  await expect(entry.locator('form [data-slot="input"]')).not.toHaveCount(0);
  await expect(unhinted(entry.locator("form"))).toHaveCount(0);
  await visitor.close();

  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();
  await page.goto(address("/settings/members"));
  const invite = page.locator("header").getByRole("button", { name: "Invite" });
  await waitUntilTakenOver(invite);
  await invite.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator('[data-slot="input"]')).not.toHaveCount(0);
  await expect(unhinted(dialog)).toHaveCount(0);

  await page.goto(address("/settings/profile"));
  await expect(page.locator('main [data-slot="input"]').first()).toBeVisible();
  await expect(unhinted(page.locator("main"))).toHaveCount(0);
  await context.close();
});

test("every search placeholder shows whole in every language: a table page's box at 1024 px and its popover and the palette at 390 and 320 px", async ({
  baseURL,
  browser,
}) => {
  test.setTimeout(240_000);
  const placeholders = await Effect.runPromise(readSearchPlaceholders);
  const tables = Arr.filter(
    placeholders,
    (entry) => entry.field === "TableSearch"
  );
  const palettes = Arr.filter(
    placeholders,
    (entry) => entry.field === "CommandInput"
  );
  expect(tables.length).toBeGreaterThan(LOCALES.length);
  expect(palettes.length).toBeGreaterThan(LOCALES.length);

  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();

  // From 1024 px the box stands in the header at its narrowest, before it widens at 1280 px.
  await page.setViewportSize({ height: 800, width: 1024 });
  await page.goto(address("/settings/members"));
  const box = '[data-slot="input-group-control"][aria-label="Find a name"]';
  await expect(page.locator(box)).toBeVisible();
  expect(
    await Effect.runPromise(cutPlaceholders(page, box, tables)),
    "the header's search box at 1024px"
  ).toEqual([]);

  for (const width of [390, 320]) {
    await page.setViewportSize({ height: 800, width });
    await page.goto(address("/settings/members"));
    // A narrow header holds the box's button, which opens the box under it.
    const open = page.getByRole("button", { exact: true, name: "Find a name" });
    await waitUntilTakenOver(open);
    await open.click();
    const popover =
      '[data-slot="popover-content"] [data-slot="input-group-control"]';
    await expect(page.locator(popover)).toBeVisible();
    expect(
      await Effect.runPromise(cutPlaceholders(page, popover, tables)),
      `the search popover at ${width}px`
    ).toEqual([]);
    await page.keyboard.press("Escape");

    // The palette's field is one field for every palette, the school's and Nakafa's. A phone opens it from
    // the search row at the head of the sidebar's sheet.
    await page
      .locator('[data-sidebar="trigger"]')
      .filter({ visible: true })
      .first()
      .click();
    await page
      .locator('[data-mobile="true"][data-slot="sidebar"]')
      .getByRole("button", { name: "Search the school..." })
      .click();
    const palette = '[role="dialog"] [data-slot="autocomplete-input"]';
    await expect(page.locator(palette)).toBeVisible();
    expect(
      await Effect.runPromise(cutPlaceholders(page, palette, palettes)),
      `the palette at ${width}px`
    ).toEqual([]);
    await page.keyboard.press("Escape");
  }
  await context.close();
});
