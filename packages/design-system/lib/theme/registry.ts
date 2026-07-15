/** Concrete visual appearance used by runtime renderers and integrations. */
export type ThemeAppearance = "light" | "dark";

type ThemeAppearancePolicy = ThemeAppearance | "dynamic";
type ThemeShaderColor = `rgb(${number}, ${number}, ${number})`;

interface ThemeDefinition {
  readonly appearance: ThemeAppearancePolicy;
  readonly shaderColor: ThemeShaderColor;
  readonly value: string;
}

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
    shaderColor: "rgb(180, 88, 30)",
  },
  {
    value: "bean",
    appearance: "light",
    shaderColor: "rgb(137, 96, 78)",
  },
  {
    value: "bubblegum",
    appearance: "light",
    shaderColor: "rgb(179, 51, 128)",
  },
  {
    value: "caffeine",
    appearance: "light",
    shaderColor: "rgb(99, 73, 63)",
  },
  {
    value: "claude",
    appearance: "light",
    shaderColor: "rgb(182, 81, 46)",
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
    shaderColor: "rgb(120, 90, 197)",
  },
  {
    value: "ghibli",
    appearance: "light",
    shaderColor: "rgb(98, 101, 24)",
  },
  {
    value: "luxury",
    appearance: "light",
    shaderColor: "rgb(155, 44, 44)",
  },
  {
    value: "matcha",
    appearance: "light",
    shaderColor: "rgb(96, 115, 102)",
  },
  {
    value: "nature",
    appearance: "light",
    shaderColor: "rgb(48, 123, 52)",
  },
  {
    value: "neo",
    appearance: "light",
    shaderColor: "rgb(231, 8, 28)",
  },
  {
    value: "notebook",
    appearance: "light",
    shaderColor: "rgb(96, 96, 96)",
  },
  {
    value: "pacman",
    appearance: "light",
    shaderColor: "rgb(144, 106, 0)",
  },
  {
    value: "perpetuity",
    appearance: "light",
    shaderColor: "rgb(0, 117, 125)",
  },
  {
    value: "pinky",
    appearance: "light",
    shaderColor: "rgb(213, 0, 112)",
  },
  {
    value: "popsicle",
    appearance: "light",
    shaderColor: "rgb(79, 70, 229)",
  },
  {
    value: "retro",
    appearance: "light",
    shaderColor: "rgb(190, 32, 113)",
  },
  {
    value: "shell",
    appearance: "light",
    shaderColor: "rgb(62, 67, 240)",
  },
  {
    value: "solar",
    appearance: "light",
    shaderColor: "rgb(179, 81, 0)",
  },
  {
    value: "sunset",
    appearance: "light",
    shaderColor: "rgb(194, 74, 45)",
  },
  {
    value: "tangerine",
    appearance: "light",
    shaderColor: "rgb(186, 59, 19)",
  },
  {
    value: "tokyo",
    appearance: "light",
    shaderColor: "rgb(97, 39, 205)",
  },
  {
    value: "tree",
    appearance: "light",
    shaderColor: "rgb(84, 97, 0)",
  },
  {
    value: "twitter",
    appearance: "light",
    shaderColor: "rgb(0, 116, 184)",
  },
  {
    value: "vintage",
    appearance: "light",
    shaderColor: "rgb(141, 99, 56)",
  },
  {
    value: "windy",
    appearance: "light",
    shaderColor: "rgb(57, 90, 161)",
  },
  {
    value: "zelda",
    appearance: "light",
    shaderColor: "rgb(130, 102, 0)",
  },
] as const satisfies readonly ThemeDefinition[];

/** Theme identifier accepted by the shared runtime and document bootstrap. */
export type ThemeValue = (typeof themes)[number]["value"];

/** Local-storage key shared by the document bootstrap and next-themes. */
export const THEME_STORAGE_KEY = "theme";

/** First-visit theme shared by the localized document and next-themes. */
export const DEFAULT_THEME = "light" satisfies ThemeValue;

/** Concrete class names managed on the document root. */
export const concreteThemeValues = themes.flatMap((theme) =>
  theme.appearance === "dynamic" ? [] : [theme.value]
);

/**
 * Resolves a next-themes runtime value to the concrete appearance consumers
 * should render. Unknown and pre-hydration values use Nakafa's light default.
 */
export function getThemeAppearance(
  resolvedTheme: string | undefined
): ThemeAppearance {
  const definition = themes.find((theme) => theme.value === resolvedTheme);

  if (definition?.appearance === "dark") {
    return "dark";
  }

  return "light";
}

/** Returns the deterministic sRGB projection used by shader-only renderers. */
export function getThemeShaderColor(resolvedTheme: string | undefined) {
  const definition = themes.find((theme) => theme.value === resolvedTheme);

  return definition?.shaderColor ?? LIGHT_SHADER_COLOR;
}
