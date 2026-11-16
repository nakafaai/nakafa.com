import { Array as Arr, Data, Effect, Option, pipe } from "effect";
import type { Card } from "#catalog/card";

/** A card whose component has no doc comment to become its guideline. */
export class GuidelineError extends Data.TaggedError("GuidelineError")<{
  readonly message: string;
}> {}

type CardValue = typeof Card.Type;

const COMMENT_OPEN = /^\/\*\*/u;
const COMMENT_CLOSE = /\*\/$/u;
const COMMENT_STAR = /^\s*\* ?/u;
const DECLARED = /^export\s+(?:function|const|class)\s+(?<name>[A-Za-z]\w*)/gmu;
const LISTED = /^export\s*\{(?<names>[^}]*)\}/gmu;
const ALIAS = /\s+as\s+/u;

/** The text of a doc comment, without its frame and its leading stars. */
function commentText(comment: string) {
  return pipe(
    comment.replace(COMMENT_OPEN, "").replace(COMMENT_CLOSE, "").split("\n"),
    Arr.map((line) => line.replace(COMMENT_STAR, "").trimEnd()),
    Arr.join("\n")
  ).trim();
}

/**
 * The doc comment written right above the function or constant that declares the card's component. Its first
 * sentence is the card's summary on the page.
 */
export const guideline = Effect.fn("designSystem.catalog.guideline")(function* (
  card: CardValue,
  source: string,
  file: string
) {
  const declaration = new RegExp(
    String.raw`(?<comment>\/\*\*(?:(?!\*\/)[\s\S])*\*\/)\s*(?:export\s+)?(?:function|const)\s+${card.declaration}\b`,
    "u"
  );
  const match = Option.fromNullishOr(declaration.exec(source)?.groups?.comment);
  return yield* Effect.fromOption(match).pipe(
    Effect.map(commentText),
    Effect.mapError(
      () =>
        new GuidelineError({
          message: `${file} needs a doc comment on ${card.declaration}, the guideline of the ${card.name} card.`,
        })
    )
  );
});

/** One named group of a match, which a pattern that matched always holds. */
function group(match: RegExpExecArray, name: string) {
  return Option.toArray(
    pipe(
      Option.fromNullishOr(match.groups),
      Option.flatMap((groups) => Option.fromNullishOr(groups[name]))
    )
  );
}

/** The name a part of an export list exports: its alias when it has one, and nothing for a type. */
function exported(part: string) {
  return Arr.flatMap(
    Option.toArray(Arr.last(part.trim().split(ALIAS))),
    (name) => {
      const trimmed = name.trim();
      return trimmed === "" || trimmed.startsWith("type ") ? [] : [trimmed];
    }
  );
}

/** The names a module exports, in the order it declares them. */
export function exportsOf(source: string) {
  const declared = Arr.flatMap(
    Arr.fromIterable(source.matchAll(DECLARED)),
    (match) => group(match, "name")
  );
  const listed = Arr.flatMap(
    Arr.fromIterable(source.matchAll(LISTED)),
    (match) =>
      Arr.flatMap(group(match, "names"), (names) =>
        Arr.flatMap(names.split(","), exported)
      )
  );
  return Arr.dedupe([...declared, ...listed]);
}

/** A card's guideline page: its component's doc comment, the parts its module exports, and where its code lives. */
export function readme(
  card: CardValue,
  text: string,
  parts: readonly string[],
  file: string
) {
  return Arr.join(
    [
      `# ${card.name}`,
      "",
      text,
      "",
      "## Parts",
      "",
      ...Arr.map(parts, (part) => `- \`${part}\``),
      "",
      "## Source",
      "",
      `- \`packages/design-system/${file}\``,
      "",
    ],
    "\n"
  );
}

/** The preview document of a card: the page preloads the bundle, which mounts the card's live example. */
export function preview(card: CardValue) {
  return Arr.join(
    [
      `<!-- @dsCard group="${card.group}" height=${card.height} -->`,
      "<!doctype html>",
      '<html lang="en">',
      `<head><meta charset="utf-8"><title>${card.name}</title></head>`,
      "<body>",
      '<div id="root"></div>',
      `<script>window.Nakafa.showcase("${card.name}");</script>`,
      "</body>",
      "</html>",
      "",
    ],
    "\n"
  );
}
