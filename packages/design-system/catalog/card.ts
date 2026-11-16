import { Data, Effect, Schema } from "effect";

/** The sections of the design system page, in page order. */
export const Group = Schema.Literals([
  "Actions",
  "Forms",
  "Content",
  "Feedback",
  "Overlays",
  "Menus",
  "Navigation",
  "Chat",
  "Identity",
]);

/**
 * One card of the design system page: the bundle export it shows, its section, the height of its preview row, and
 * the `components/ui` module whose doc comment on that export becomes the card's guideline.
 */
export const Card = Schema.Struct({
  name: Schema.String.check(Schema.isPattern(/^[A-Z][A-Za-z]+$/u)),
  group: Group,
  height: Schema.Int.check(Schema.isBetween({ minimum: 40, maximum: 4000 })),
  source: Schema.String.check(Schema.isPattern(/^[a-z]+(?:-[a-z]+)*$/u)),
});

/** A card module whose `card` export the generator cannot read. */
export class CardError extends Data.TaggedError("CardError")<{
  readonly message: string;
}> {}

const LITERAL = /export const card = \{(?<body>[^}]*)\}/u;

/** One field of the `card` literal a card module exports, as written. */
function field(text: string, name: string) {
  const literal = LITERAL.exec(text)?.groups?.body ?? "";
  const match = new RegExp(
    String.raw`\b${name}: (?:"(?<text>[^"]+)"|(?<number>\d+))`,
    "u"
  ).exec(literal);
  return match?.groups?.text ?? match?.groups?.number;
}

/**
 * Reads the `card` a card module exports. The generator runs in Node, which cannot load the module's JSX, so it reads
 * the literal and checks it against the schema, the same contract the module's own type states.
 */
export const readCard = Effect.fn("designSystem.catalog.readCard")(function* (
  text: string,
  file: string
) {
  return yield* Schema.decodeUnknownEffect(Card)({
    name: field(text, "name"),
    group: field(text, "group"),
    height: Number(field(text, "height")),
    source: field(text, "source"),
  }).pipe(
    Effect.mapError(
      (issue) =>
        new CardError({
          message: `catalog/cards/${file} exports no valid card: ${issue.message}`,
        })
    )
  );
});
