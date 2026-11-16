import { runMain } from "@effect/platform-node/NodeRuntime";
import { layer } from "@effect/platform-node/NodeServices";
import {
  Array as Arr,
  Config,
  Data,
  Effect,
  FileSystem,
  Order,
  Path,
  Record as Rec,
  Result,
  Schema,
} from "effect";
import postcss from "postcss";
import { bundle } from "#catalog/bundle";
import { readCard } from "#catalog/card";
import { exportsOf, guideline, preview, readme } from "#catalog/docs";
import { entryModule, GLOBALS, LIBRARIES, shimName } from "#catalog/entry";
import { catalogSheet } from "#catalog/sheet";
import { uncovered } from "#catalog/skipped";
import { themesSection } from "#catalog/themes";
import { readTokens, Tokens } from "#catalog/tokens";

/** A design system module that no card shows and no skip names, or a skip that names nothing. */
class CoverageError extends Data.TaggedError("CoverageError")<{
  readonly message: string;
}> {}

/**
 * Writes every file of the Nakafa design system artifact under `CATALOG_OUT/project` from the code: the tokens from
 * the stylesheets, the brand book, the logo and fonts, the component bundle and stylesheet, and one preview and
 * guideline per card. Publishing those files to the artifact is a separate step.
 */
const generate = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const paths = yield* Path.Path;
  const out = `${yield* Config.schema(Schema.NonEmptyString, "CATALOG_OUT")}/project`;
  const root = `${import.meta.dirname}/..`;
  const packages = `${root}/..`;
  const work = `${root}/node_modules/.catalog`;
  const write = (path: string, text: string) =>
    Effect.andThen(
      fs.makeDirectory(paths.dirname(`${out}/${path}`), { recursive: true }),
      fs.writeFileString(`${out}/${path}`, text)
    );

  const modules = Arr.sort(
    Arr.filterMap(yield* fs.readDirectory(`${root}/components/ui`), (file) =>
      file.endsWith(".tsx")
        ? Result.succeed(file.slice(0, -4))
        : Result.failVoid
    ),
    Order.String
  );
  const files = Arr.sort(
    Arr.filter(yield* fs.readDirectory(`${root}/catalog/cards`), (file) =>
      file.endsWith(".tsx")
    ),
    Order.String
  );
  const cards = yield* Effect.forEach(files, (file) =>
    Effect.flatMap(fs.readFileString(`${root}/catalog/cards/${file}`), (text) =>
      readCard(text, file)
    )
  );

  const components = Arr.filterMap(
    yield* fs.readDirectory(`${root}/components`, { recursive: true }),
    (file) =>
      file.endsWith(".tsx") &&
      !file.endsWith(".test.tsx") &&
      !file.includes("/test.")
        ? Result.succeed(`components/${file.slice(0, -4)}`)
        : Result.failVoid
  );
  const gaps = uncovered(
    components,
    Arr.map(cards, (card) => card.source)
  );
  if (Arr.isReadonlyArrayNonEmpty(gaps)) {
    return yield* new CoverageError({ message: Arr.join(gaps, "\n") });
  }

  const parse = (path: string) =>
    Effect.map(fs.readFileString(path), (text) =>
      postcss.parse(text, { from: path })
    );
  const globals = yield* parse(`${root}/styles/globals.css`);
  const identity = yield* parse(`${root}/styles/identity.css`);
  const scale = yield* parse(`${root}/node_modules/tailwindcss/theme.css`);
  const tokens = yield* readTokens(globals, identity, scale);
  const themesPath = `${packages}/../apps/www/public/themes.css`;
  const themes = yield* parse(themesPath);

  yield* fs.makeDirectory(work, { recursive: true });
  yield* Effect.forEach(Rec.toEntries(GLOBALS), ([module, global]) =>
    fs.writeFileString(
      `${work}/${shimName(module)}`,
      `module.exports = ${global};\n`
    )
  );
  yield* fs.writeFileString(
    `${work}/catalog.css`,
    catalogSheet(globals, `${root}/styles`, themesPath)
  );
  yield* fs.writeFileString(
    `${work}/entry.ts`,
    entryModule(
      modules,
      Arr.map(files, (file) => file.slice(0, -4)),
      Arr.filterMap(cards, (card) =>
        card.source.startsWith("components/ui/")
          ? Result.failVoid
          : Result.succeed([card.name, card.source] as const)
      ),
      root
    )
  );
  yield* Effect.forEach(Rec.toEntries(LIBRARIES), ([name, text]) =>
    Effect.andThen(
      fs.writeFileString(`${work}/${name}.ts`, text),
      bundle({
        entry: `${work}/${name}.ts`,
        global: name === "react" ? "React" : "ReactDOM",
        file: name,
        out: `${out}/components/lib`,
        packages,
        work,
        globals: name === "react" ? [] : ["react"],
      })
    )
  );
  yield* bundle({
    entry: `${work}/entry.ts`,
    global: "Nakafa",
    file: "bundle",
    out: `${out}/components`,
    packages,
    work,
    globals: Rec.keys(GLOBALS),
  });

  yield* write(
    "tokens.json",
    `${yield* Schema.encodeEffect(Schema.fromJsonString(Tokens))(tokens)}\n`
  );
  yield* write("themes.md", themesSection(themes));
  yield* write(
    "README.md",
    yield* fs.readFileString(`${root}/catalog/brand.md`)
  );
  yield* fs.makeDirectory(`${out}/assets/Logos`, { recursive: true });
  yield* fs.copyFile(
    `${packages}/../apps/www/public/logo.svg`,
    `${out}/assets/Logos/logo.svg`
  );
  yield* fs.makeDirectory(`${out}/fonts`, { recursive: true });
  yield* fs.copyFile(
    `${root}/node_modules/@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2`,
    `${out}/fonts/geist-mono-latin-wght-normal.woff2`
  );
  yield* Effect.forEach(cards, (card) =>
    Effect.gen(function* () {
      const file = (yield* fs.exists(`${root}/${card.source}.tsx`))
        ? `${card.source}.tsx`
        : `${card.source}.ts`;
      const source = yield* fs.readFileString(`${root}/${file}`);
      const text = yield* guideline(card, source, file);
      yield* write(
        `components/${card.name}/README.md`,
        readme(card, text, exportsOf(source), file)
      );
      yield* write(`components/${card.name}/preview.html`, preview(card));
    })
  );
  yield* Effect.log(
    `Wrote ${cards.length} cards and the tokens, bundle and brand book to ${out}.`
  );
});

runMain(generate.pipe(Effect.provide(layer)));
