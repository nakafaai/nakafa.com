import { Array as Arr, Option, Schema } from "effect";

const ThemeAppearanceSchema = Schema.Literals(["light", "dark"]);

/** Concrete visual appearance used by runtime renderers and integrations. */
type ThemeAppearance = typeof ThemeAppearanceSchema.Type;

const ThemeShaderColorSchema = Schema.TemplateLiteral([
  "rgb(",
  Schema.Finite,
  ", ",
  Schema.Finite,
  ", ",
  Schema.Finite,
  ")",
]);

/** Concrete sRGB projection painted by shader-only renderers. */
type ThemeShaderColor = typeof ThemeShaderColorSchema.Type;

/** One selectable Nakafa theme, its appearance policy, and its shader color. */
const ThemeDefinitionSchema = Schema.Struct({
  appearance: Schema.Union([ThemeAppearanceSchema, Schema.Literal("dynamic")]),
  shaderColor: ThemeShaderColorSchema,
  value: Schema.String,
});

type ThemeDefinition = typeof ThemeDefinitionSchema.Type;

const LIGHT_SHADER_COLOR = "rgb(21, 41, 79)";

/** Selectable Nakafa themes and the appearance policy owned by each theme. */
export const themes = [
  {
    value: "light",
    appearance: "light",
    shaderColor: LIGHT_SHADER_COLOR,
  },
  {
    value: "dark",
    appearance: "dark",
    shaderColor: "rgb(57, 199, 244)",
  },
  {
    value: "system",
    appearance: "dynamic",
    shaderColor: LIGHT_SHADER_COLOR,
  },
  {
    value: "darkmatter",
    appearance: "light",
    shaderColor: "rgb(177, 85, 26)",
  },
  {
    value: "bean",
    appearance: "light",
    shaderColor: "rgb(125, 85, 68)",
  },
  {
    value: "bubblegum",
    appearance: "light",
    shaderColor: "rgb(170, 41, 119)",
  },
  {
    value: "caffeine",
    appearance: "light",
    shaderColor: "rgb(99, 73, 63)",
  },
  {
    value: "claude",
    appearance: "light",
    shaderColor: "rgb(173, 73, 38)",
  },
  {
    value: "cosmic",
    appearance: "light",
    shaderColor: "rgb(110, 85, 207)",
  },
  {
    value: "cute",
    appearance: "light",
    shaderColor: "rgb(167, 67, 112)",
  },
  {
    value: "dreamy",
    appearance: "light",
    shaderColor: "rgb(119, 88, 195)",
  },
  {
    value: "ghibli",
    appearance: "light",
    shaderColor: "rgb(90, 93, 12)",
  },
  {
    value: "luxury",
    appearance: "light",
    shaderColor: "rgb(155, 44, 44)",
  },
  {
    value: "matcha",
    appearance: "light",
    shaderColor: "rgb(88, 107, 94)",
  },
  {
    value: "nature",
    appearance: "light",
    shaderColor: "rgb(45, 120, 49)",
  },
  {
    value: "neo",
    appearance: "light",
    shaderColor: "rgb(222, 1, 25)",
  },
  {
    value: "notebook",
    appearance: "light",
    shaderColor: "rgb(96, 96, 96)",
  },
  {
    value: "pacman",
    appearance: "light",
    shaderColor: "rgb(143, 106, 0)",
  },
  {
    value: "perpetuity",
    appearance: "light",
    shaderColor: "rgb(1, 116, 124)",
  },
  {
    value: "pinky",
    appearance: "light",
    shaderColor: "rgb(205, 1, 108)",
  },
  {
    value: "popsicle",
    appearance: "light",
    shaderColor: "rgb(79, 70, 229)",
  },
  {
    value: "retro",
    appearance: "light",
    shaderColor: "rgb(153, 1, 87)",
  },
  {
    value: "shell",
    appearance: "light",
    shaderColor: "rgb(62, 67, 240)",
  },
  {
    value: "solar",
    appearance: "light",
    shaderColor: "rgb(173, 78, 1)",
  },
  {
    value: "sunset",
    appearance: "light",
    shaderColor: "rgb(192, 72, 44)",
  },
  {
    value: "tangerine",
    appearance: "light",
    shaderColor: "rgb(186, 59, 19)",
  },
  {
    value: "tokyo",
    appearance: "light",
    shaderColor: "rgb(92, 29, 198)",
  },
  {
    value: "tree",
    appearance: "light",
    shaderColor: "rgb(80, 94, 0)",
  },
  {
    value: "twitter",
    appearance: "light",
    shaderColor: "rgb(1, 107, 169)",
  },
  {
    value: "vintage",
    appearance: "light",
    shaderColor: "rgb(134, 93, 50)",
  },
  {
    value: "windy",
    appearance: "light",
    shaderColor: "rgb(57, 90, 161)",
  },
  {
    value: "zelda",
    appearance: "light",
    shaderColor: "rgb(126, 99, 0)",
  },
] as const satisfies readonly ThemeDefinition[];

/** Theme identifier accepted by the shared next-themes runtime. */
type ThemeValue = (typeof themes)[number]["value"];

/** Local-storage key owned by the shared next-themes runtime. */
export const THEME_STORAGE_KEY = "theme";

/** First-visit theme applied by the shared next-themes runtime. */
export const DEFAULT_THEME = "system" satisfies ThemeValue;

/** Concrete class names managed on the document root. */
export const concreteThemeValues = Arr.flatMap(themes, (theme) =>
  theme.appearance === "dynamic" ? [] : [theme.value]
);

/**
 * Resolves a next-themes runtime value to the concrete appearance consumers
 * should render. Unknown and pre-hydration values use Nakafa's light default.
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

/** Returns the deterministic sRGB projection used by shader-only renderers. */
export function getThemeShaderColor(resolvedTheme: string | undefined) {
  const definition = Arr.findFirst(
    themes,
    (theme) => theme.value === resolvedTheme
  );

  return Option.isSome(definition)
    ? definition.value.shaderColor
    : LIGHT_SHADER_COLOR;
}

/**
 * Projects one registered shader color at an explicit alpha. The projection
 * stays beside the registered colors so no renderer re-derives their format.
 */
export function getThemeShaderAlphaColor(
  color: ThemeShaderColor,
  alpha: number
) {
  return color.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
}
