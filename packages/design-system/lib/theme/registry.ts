import { Array as Arr, Option, Schema } from "effect";

const ThemeAppearanceSchema = Schema.Literals(["light", "dark"]);

/** Concrete visual appearance used by runtime renderers and integrations. */
export type ThemeAppearance = typeof ThemeAppearanceSchema.Type;

/** One selectable Nakafa theme and its appearance policy. */
const ThemeDefinitionSchema = Schema.Struct({
  appearance: Schema.Union([ThemeAppearanceSchema, Schema.Literal("dynamic")]),
  value: Schema.String,
});

type ThemeDefinition = typeof ThemeDefinitionSchema.Type;

/** Selectable Nakafa themes and the appearance policy owned by each theme. */
export const themes = [
  {
    value: "light",
    appearance: "light",
  },
  {
    value: "dark",
    appearance: "dark",
  },
  {
    value: "system",
    appearance: "dynamic",
  },
  {
    value: "darkmatter",
    appearance: "light",
  },
  {
    value: "bean",
    appearance: "light",
  },
  {
    value: "bubblegum",
    appearance: "light",
  },
  {
    value: "caffeine",
    appearance: "light",
  },
  {
    value: "claude",
    appearance: "light",
  },
  {
    value: "cosmic",
    appearance: "light",
  },
  {
    value: "cute",
    appearance: "light",
  },
  {
    value: "dreamy",
    appearance: "light",
  },
  {
    value: "ghibli",
    appearance: "light",
  },
  {
    value: "luxury",
    appearance: "light",
  },
  {
    value: "matcha",
    appearance: "light",
  },
  {
    value: "nature",
    appearance: "light",
  },
  {
    value: "neo",
    appearance: "light",
  },
  {
    value: "notebook",
    appearance: "light",
  },
  {
    value: "pacman",
    appearance: "light",
  },
  {
    value: "perpetuity",
    appearance: "light",
  },
  {
    value: "pinky",
    appearance: "light",
  },
  {
    value: "popsicle",
    appearance: "light",
  },
  {
    value: "retro",
    appearance: "light",
  },
  {
    value: "shell",
    appearance: "light",
  },
  {
    value: "solar",
    appearance: "light",
  },
  {
    value: "sunset",
    appearance: "light",
  },
  {
    value: "tangerine",
    appearance: "light",
  },
  {
    value: "tokyo",
    appearance: "light",
  },
  {
    value: "tree",
    appearance: "light",
  },
  {
    value: "twitter",
    appearance: "light",
  },
  {
    value: "vintage",
    appearance: "light",
  },
  {
    value: "windy",
    appearance: "light",
  },
  {
    value: "zelda",
    appearance: "light",
  },
] as const satisfies readonly ThemeDefinition[];

/** Every selectable theme, the system choice included. */
const ThemeChoiceSchema = Schema.Literals(
  Arr.map(themes, (theme) => theme.value)
);

/** The visitor's choice: a named theme, or system to follow the system appearance. */
export type ThemeChoice = typeof ThemeChoiceSchema.Type;

/** Local-storage key that holds the visitor's theme choice. */
export const THEME_STORAGE_KEY = "theme";

/** First-visit choice, and the choice of a stored value that names no theme. */
export const DEFAULT_THEME = "system" satisfies ThemeChoice;

/** Concrete class names managed on the document root. */
export const concreteThemeValues = Arr.flatMap(themes, (theme) =>
  theme.appearance === "dynamic" ? [] : [theme.value]
);

/** A theme shown as itself: every choice except system. */
export type ConcreteTheme = (typeof concreteThemeValues)[number];

/** The stylesheet of the named themes. Few people pick one, so it stays out of the stylesheet every page blocks on. */
export const THEME_SHEET_PATH = "/themes.css";

/** Whether a concrete theme is a named one, whose colors live in that stylesheet. */
export function isNamedTheme(theme: string) {
  return theme !== "light" && theme !== "dark";
}

const decodeThemeChoice = Schema.decodeUnknownOption(ThemeChoiceSchema);

/**
 * Reads a stored choice. A missing value and a value that names no theme are
 * the system choice, so the pre-paint script and the theme store agree.
 */
export function parseThemeChoice(stored: Option.Option<string>): ThemeChoice {
  return Option.getOrElse(
    Option.flatMap(stored, decodeThemeChoice),
    () => DEFAULT_THEME
  );
}

/** Resolves a choice to the theme it shows: system shows the system appearance. */
export function resolveThemeChoice(
  choice: ThemeChoice,
  systemAppearance: ThemeAppearance
): ConcreteTheme {
  return choice === "system" ? systemAppearance : choice;
}

/**
 * Resolves a theme name to the concrete appearance consumers should render.
 * Unknown and pre-hydration values use Nakafa's light default.
 */
export function getThemeAppearance(
  resolvedTheme: string | undefined
): ThemeAppearance {
  const definition = Arr.findFirst(
    themes,
    (theme) => theme.value === resolvedTheme
  );

  if (Option.exists(definition, (theme) => theme.appearance === "dark")) {
    return "dark";
  }

  return "light";
}
