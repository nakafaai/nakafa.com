import {
  Array as Arr,
  Data,
  Effect,
  Option,
  pipe,
  Result,
  Schema,
} from "effect";
import type {
  AtRule,
  ChildNode,
  Comment,
  Declaration,
  Root,
  Rule,
} from "postcss";

/** A token the stylesheet declares without the comment that says what it is for. */
class TokenSourceError extends Data.TaggedError("TokenSourceError")<{
  readonly message: string;
}> {}

const Entry = Schema.Struct({
  name: Schema.String,
  value: Schema.String,
  usage: Schema.String,
});

const ColorEntry = Schema.Struct({
  name: Schema.String,
  value: Schema.Struct({ light: Schema.String, dark: Schema.String }),
  usage: Schema.String,
});

const Style = Schema.Struct({
  name: Schema.String,
  fontSize: Schema.String,
  lineHeight: Schema.String,
  fontWeight: Schema.Int,
  usage: Schema.String,
});

/** A token a block declares: its name and its value. */
const Named = Schema.Struct({ name: Schema.String, value: Schema.String });

/** A token a block declares, with the comment on the line above it when it has one. */
const Commented = Schema.Struct({
  name: Schema.String,
  usage: Schema.Option(Schema.String),
});

/** The tokens file the design system page reads, in the shape its type defines. */
export const Tokens = Schema.Struct({
  name: Schema.String,
  version: Schema.Int,
  color: Schema.Struct({
    themes: Schema.Array(
      Schema.Struct({ id: Schema.String, name: Schema.String })
    ),
    tokens: Schema.Array(ColorEntry),
  }),
  type: Schema.Struct({
    fonts: Schema.Array(
      Schema.Struct({
        family: Schema.String,
        file: Schema.String,
        weight: Schema.String,
        style: Schema.String,
      })
    ),
    families: Schema.Record(Schema.String, Schema.String),
    groups: Schema.Array(
      Schema.Struct({
        name: Schema.String,
        family: Schema.String,
        styles: Schema.Array(Style),
      })
    ),
  }),
  spacing: Schema.Struct({ tokens: Schema.Array(Entry) }),
  radius: Schema.Struct({ tokens: Schema.Array(Entry) }),
  shadow: Schema.Struct({ tokens: Schema.Array(Entry) }),
  easing: Schema.Struct({ tokens: Schema.Array(Entry) }),
  duration: Schema.Struct({ tokens: Schema.Array(Entry) }),
});

/** The steps of Tailwind's type scale the product uses, with what each one sets. */
const TYPE_STEPS = [
  ["Interface", "xs", "Badges, tooltips and metadata."],
  [
    "Interface",
    "sm",
    "The interface default: labels, menus, table cells and body copy in the app.",
  ],
  ["Interface", "base", "Card titles and reading text."],
  ["Headings", "xl", "Dialog titles and lesson h3."],
  ["Headings", "2xl", "Lesson h2."],
  ["Marketing", "4xl", "Marketing section headings."],
  ["Marketing", "5xl", "The marketing hero headline."],
] as const;

/** The spacing steps of the 4px grid that the product reaches for most. */
const SPACING_STEPS = [
  [1, "Between an icon and its label."],
  [2, "Inside a group: a label tight on its value."],
  [3, "Between the choices of one group."],
  [4, "A small card's padding, and between fields."],
  [6, "A card's padding and gap."],
  [8, "Between sections of a form."],
  [12, "Between page sections in the app."],
  [24, "Between marketing sections."],
] as const;

const children = (container: Root | Rule | AtRule): readonly ChildNode[] =>
  container.nodes ?? [];

/** The block of a stylesheet that the selector or at-rule opens at its top level. */
function block(root: Root, match: (node: ChildNode) => boolean) {
  return Arr.findFirst(
    children(root),
    (node): node is Rule | AtRule =>
      (node.type === "rule" || node.type === "atrule") && match(node)
  );
}

function rule(root: Root, selector: string) {
  return block(
    root,
    (node) => node.type === "rule" && node.selector === selector
  );
}

function theme(root: Root, params: string) {
  return block(
    root,
    (node) =>
      node.type === "atrule" && node.name === "theme" && node.params === params
  );
}

/** Each custom property a block declares, with the comment written on the line above it. */
function declarations(container: Rule | AtRule) {
  return Arr.filterMap(children(container), (node) => {
    if (node.type !== "decl" || !node.prop.startsWith("--")) {
      return Result.failVoid;
    }
    const usage = pipe(
      Option.fromNullishOr(node.prev()),
      Option.filter(
        (previous): previous is Comment => previous.type === "comment"
      ),
      Option.map((comment) => comment.text.trim())
    );
    return Result.succeed({
      name: node.prop.slice(2),
      value: normalize(node),
      usage,
    });
  });
}

/** A value on one line, as the page's grammar expects. */
function normalize(node: Declaration) {
  return node.value.replaceAll(/\s+/gu, " ").trim();
}

const required = (container: Option.Option<Rule | AtRule>, label: string) =>
  Effect.fromOption(container).pipe(
    Effect.mapError(
      () =>
        new TokenSourceError({
          message: `The stylesheet has no ${label} block.`,
        })
    )
  );

/** The comment above a token, or a failure that names the token missing one. */
function usageOf(token: typeof Commented.Type) {
  return Effect.fromOption(token.usage).pipe(
    Effect.mapError(
      () =>
        new TokenSourceError({
          message: `--${token.name} needs a comment on the line above it that says what it is for.`,
        })
    ),
    Effect.filterOrFail(
      (usage) =>
        !token.name.endsWith(FOREGROUND) ||
        usage.includes(`\`${token.name.slice(0, -FOREGROUND.length)}\``),
      () =>
        new TokenSourceError({
          message: `--${token.name} needs its ground named in its comment, as \`${token.name.slice(0, -FOREGROUND.length)}\`, so the design system page measures it on that surface.`,
        })
    )
  );
}

/** The suffix of a color drawn on another, whose ground its comment names. */
const FOREGROUND = "-foreground";

/** A rem length as pixels, for the page's type view. */
function pixels(value: string) {
  return `${Number.parseFloat(value) * 16}px`;
}

const CALC = /^calc\((?<top>[\d.]+) \/ (?<bottom>[\d.]+)\)$/u;
const COLOR_PREFIX = /^color-/u;
const OFFSET = /(?<sign>[+-]) (?<amount>\d+)px/u;

/** A line height Tailwind writes as `calc(a / b)`, as a plain number. */
function ratio(value: string) {
  const match = CALC.exec(value);
  const top = Number(match?.groups?.top ?? value);
  const bottom = Number(match?.groups?.bottom ?? 1);
  return `${Math.round((top / bottom) * 1000) / 1000}`;
}

/** The value a block declares for one token, or a failure that names the block and the token it lacks. */
function declared(
  tokens: readonly (typeof Named.Type)[],
  name: string,
  block: string
) {
  return Effect.fromOption(
    Arr.findFirst(tokens, (token) => token.name === name)
  ).pipe(
    Effect.map((token) => token.value),
    Effect.mapError(
      () => new TokenSourceError({ message: `${block} declares no --${name}.` })
    )
  );
}

/** Reads every token the design system page shows from the stylesheets that declare it. */
export const readTokens = Effect.fn("designSystem.catalog.readTokens")(
  function* (globals: Root, identity: Root, scale: Root) {
    const light = declarations(
      yield* required(rule(globals, ":root"), ":root")
    );
    const dark = declarations(yield* required(rule(globals, ".dark"), ".dark"));
    const motion = declarations(yield* required(theme(globals, ""), "@theme"));
    const inline = declarations(
      yield* required(theme(globals, "inline"), "@theme inline")
    );
    const fixed = declarations(
      yield* required(theme(identity, "static"), "@theme static")
    );
    const tailwind = declarations(
      yield* required(theme(scale, "default"), "Tailwind @theme default")
    );

    const themed = Arr.filter(
      light,
      (token) => !(token.name.startsWith("shadow") || token.name === "radius")
    );
    const colors = yield* Effect.forEach(themed, (token) =>
      Effect.all({
        usage: usageOf(token),
        dark: declared(dark, token.name, ".dark"),
      }).pipe(
        Effect.map(({ usage, dark: value }) => ({
          name: token.name,
          value: { light: token.value, dark: value },
          usage,
        }))
      )
    );
    const identityColors = yield* Effect.forEach(fixed, (token) =>
      Effect.map(usageOf(token), (usage) => ({
        name: token.name.replace(COLOR_PREFIX, ""),
        value: { light: token.value, dark: token.value },
        usage,
      }))
    );
    const entries = (tokens: typeof light) =>
      Effect.forEach(tokens, (token) =>
        Effect.map(usageOf(token), (usage) => ({
          name: token.name,
          value: token.value,
          usage,
        }))
      );
    const shadows = yield* entries(
      Arr.filter(light, (token) => token.name.startsWith("shadow"))
    );
    const base = Number.parseFloat(yield* declared(light, "radius", ":root"));
    const radii = yield* Effect.forEach(
      Arr.filter(inline, (token) => token.name.startsWith("radius-")),
      (token) =>
        Effect.map(usageOf(token), (usage) => {
          const offset = OFFSET.exec(token.value)?.groups;
          const delta =
            offset === undefined
              ? 0
              : Number(offset.amount) * (offset.sign === "-" ? -1 : 1);
          return { name: token.name, value: `${base * 16 + delta}px`, usage };
        })
    );
    const easing = yield* entries(
      Arr.filter(motion, (token) => token.name.startsWith("ease-"))
    );
    const duration = yield* entries(
      Arr.filter(motion, (token) =>
        token.name.startsWith("transition-duration-")
      )
    );
    const spacing =
      Number.parseFloat(
        yield* declared(tailwind, "spacing", "Tailwind's theme")
      ) * 16;
    const styles = yield* Effect.forEach(TYPE_STEPS, ([group, step, usage]) =>
      Effect.all({
        size: declared(tailwind, `text-${step}`, "Tailwind's theme"),
        leading: declared(
          tailwind,
          `text-${step}--line-height`,
          "Tailwind's theme"
        ),
      }).pipe(
        Effect.map(({ size, leading }) => ({
          group,
          style: {
            name: `text-${step}`,
            fontSize: pixels(size),
            lineHeight: ratio(leading),
            fontWeight: group === "Interface" ? 400 : 500,
            usage,
          },
        }))
      )
    );
    const chat = yield* Effect.all({
      size: declared(inline, "text-chat", "@theme inline"),
      leading: declared(inline, "text-chat--line-height", "@theme inline"),
    });

    return Tokens.make({
      name: "Nakafa",
      version: 3,
      color: {
        themes: [
          { id: "light", name: "Light" },
          { id: "dark", name: "Dark" },
        ],
        tokens: [...colors, ...identityColors],
      },
      type: {
        fonts: [
          {
            family: "Geist Mono",
            file: "fonts/geist-mono-latin-wght-normal.woff2",
            weight: "100 900",
            style: "normal",
          },
        ],
        families: {
          sans: '"Inter", system-ui, sans-serif',
          mono: '"Geist Mono", ui-monospace, monospace',
        },
        groups: [
          ...Arr.map(
            Arr.dedupe(Arr.map(TYPE_STEPS, ([group]) => group)),
            (group) => ({
              name: group,
              family: "sans",
              styles: Arr.filterMap(styles, (entry) =>
                entry.group === group
                  ? Result.succeed(entry.style)
                  : Result.failVoid
              ),
            })
          ),
          {
            name: "Chat",
            family: "sans",
            styles: [
              {
                name: "text-chat",
                fontSize: chat.size,
                lineHeight: chat.leading,
                fontWeight: 400,
                usage: "Nina's answers and lesson prose.",
              },
            ],
          },
        ],
      },
      spacing: {
        tokens: Arr.map(SPACING_STEPS, ([step, usage]) => ({
          name: `space-${step}`,
          value: `${step * spacing}px`,
          usage,
        })),
      },
      radius: {
        tokens: [
          ...radii,
          {
            name: "radius-full",
            value: "9999px",
            usage: "People, pills and switches.",
          },
        ],
      },
      shadow: { tokens: shadows },
      easing: { tokens: easing },
      duration: { tokens: duration },
    });
  }
);
