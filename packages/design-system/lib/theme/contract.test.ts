// @vitest-environment node
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import {
  createThemeProfiles,
  findInlineTheme,
  findTopLevelRule,
  parseThemeStylesheet,
  REQUIRED_THEME_TOKENS,
  readCustomThemeNames,
  readDirectValue,
  readOklchChannels,
  readThemeStyleSources,
  SEMANTIC_COLOR_TOKENS,
  THEME_METADATA_PROPERTIES,
  ThemeColorChannelError,
  ThemeStyleSourceLoadError,
  toRgbProjection,
} from "@repo/design-system/lib/theme/contract";
import { themes } from "@repo/design-system/lib/theme/registry";
import { Array as Arr, Effect, Option, Order } from "effect";
import postcss from "postcss";

const STATUS_NAMES = ["success", "warning", "info"];
const THEME_IDENTITY_TOKENS = [
  "--primary",
  "--secondary",
  "--accent",
  "--ring",
  "--success",
  "--warning",
  "--info",
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
] as const;
const EXPECTED_CONCRETE_THEME_COUNT = 31;
const readSources = readThemeStyleSources().pipe(
  Effect.provide(NodeServices.layer)
);
const registeredThemeNames = Arr.map(themes, (theme) => theme.value);
const concreteThemeNames = Arr.filter(
  registeredThemeNames,
  (name) => name !== "system"
);
const customThemeNames = Arr.filter(
  concreteThemeNames,
  (name) => name !== "light" && name !== "dark"
);

const readProfiles = readSources.pipe(
  Effect.map((sources) => createThemeProfiles(concreteThemeNames, sources))
);

describe("theme profile contract", () => {
  it.effect("returns a typed failure when a theme stylesheet cannot load", () =>
    Effect.gen(function* () {
      const missingPath = "/theme-contract/intentionally-missing.css";
      const result = yield* Effect.result(
        readThemeStyleSources({
          customThemes: missingPath,
          globals: missingPath,
        }).pipe(Effect.provide(NodeServices.layer))
      );
      expect(result._tag).toBe("Failure");
      if (result._tag !== "Failure") {
        return;
      }
      expect(result.failure).toBeInstanceOf(ThemeStyleSourceLoadError);
      expect(result.failure).toMatchObject({
        _tag: "ThemeStyleSourceLoadError",
        message: `Failed to load theme stylesheet at ${missingPath}.`,
        path: missingPath,
      });
    })
  );
  it.effect(
    "returns a typed failure when a theme stylesheet cannot parse",
    () =>
      Effect.gen(function* () {
        const path = "/theme-contract/invalid.css";
        const result = yield* Effect.result(parseThemeStylesheet("}", path));
        expect(result._tag).toBe("Failure");
        if (result._tag !== "Failure") {
          return;
        }
        expect(result.failure).toMatchObject({ path });
      })
  );
  it("inspects only direct declarations and simple top-level selectors", () => {
    const syntheticRoot = postcss.parse(`
      @layer base {}
      .valid { --value: oklch(0.5 0.1 240); }
      .complex:hover { --value: oklch(0.5 0.1 240); }
    `);
    const validRule = findTopLevelRule(syntheticRoot, ".valid");
    expect(findTopLevelRule(syntheticRoot, ".missing")).toBeUndefined();
    expect(findInlineTheme(syntheticRoot)).toBeUndefined();
    expect(readCustomThemeNames(syntheticRoot)).toEqual(["valid"]);
    expect(validRule).toBeDefined();
    if (!validRule) {
      return;
    }
    expect(readDirectValue(validRule, "--value")).toBe("oklch(0.5 0.1 240)");
    expect(readDirectValue(validRule, "--missing")).toBeUndefined();
    expect(
      readDirectValue(postcss.atRule({ name: "theme" }), "--missing")
    ).toBeUndefined();
  });
  it("defines the agreed 38-color and 47-declaration contracts", () => {
    expect(SEMANTIC_COLOR_TOKENS).toHaveLength(38);
    expect(Arr.dedupe(SEMANTIC_COLOR_TOKENS).length).toBe(38);
    expect(REQUIRED_THEME_TOKENS).toHaveLength(47);
    expect(Arr.dedupe(REQUIRED_THEME_TOKENS).length).toBe(47);
  });
  it.effect("projects canonical OKLCH into comma-form sRGB bytes", () =>
    Effect.gen(function* () {
      expect(yield* toRgbProjection("oklch(1 0 0)")).toBe("rgb(255, 255, 255)");
      expect(yield* toRgbProjection("oklch(0 0 0)")).toBe("rgb(0, 0, 0)");
      expect(yield* toRgbProjection("oklch(0.5 0.1 240)")).toBe(
        "rgb(31, 106, 150)"
      );
    })
  );
  it.effect("rejects an OKLCH color with an omitted numeric channel", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        readOklchChannels("oklch(none 0.1 240)")
      );

      expect(error).toBeInstanceOf(ThemeColorChannelError);
      expect(error.message).toBe(
        'Theme color "oklch(none 0.1 240)" has a missing channel.'
      );
    })
  );
  it("registers exactly 31 concrete profiles plus system preference", () => {
    expect(concreteThemeNames).toHaveLength(EXPECTED_CONCRETE_THEME_COUNT);
    expect(
      Arr.filter(registeredThemeNames, (name) => name === "system")
    ).toHaveLength(1);
    expect(Arr.dedupe(registeredThemeNames).length).toBe(themes.length);
  });
  it.effect("keeps registry custom names synchronized with CSS selectors", () =>
    Effect.gen(function* () {
      const sources = yield* readSources;

      expect(
        Arr.sort(readCustomThemeNames(sources.customThemes), Order.String)
      ).toEqual(Arr.sort(customThemeNames, Order.String));
    })
  );
  it.effect("gives every concrete theme a distinct semantic identity", () =>
    Effect.gen(function* () {
      const profiles = yield* readProfiles;
      const fingerprints = Arr.map(profiles, (profile) => {
        const rule = findTopLevelRule(profile.root, profile.selector);
        expect(rule).toBeDefined();
        if (!rule) {
          return "";
        }
        return Arr.join(
          Arr.map(
            THEME_IDENTITY_TOKENS,
            (token) => readDirectValue(rule, token) ?? ""
          ),
          "|"
        );
      });

      expect(Arr.dedupe(fingerprints).length).toBe(profiles.length);
    })
  );
  it.effect("keeps each theme's feedback palette distinct", () =>
    Effect.gen(function* () {
      const profiles = yield* readProfiles;
      const fingerprints = Arr.map(profiles, (profile) => {
        const rule = findTopLevelRule(profile.root, profile.selector);
        expect(rule).toBeDefined();
        if (!rule) {
          return "";
        }
        return Arr.join(
          Arr.flatMap(STATUS_NAMES, (status) => [
            readDirectValue(rule, `--${status}`) ?? "",
            readDirectValue(rule, `--${status}-foreground`) ?? "",
          ]),
          "|"
        );
      });

      expect(Arr.dedupe(fingerprints).length).toBe(profiles.length);
    })
  );
  it.effect.each(concreteThemeNames)(
    "$name owns each required core token once",
    (name) =>
      Effect.gen(function* () {
        const sources = yield* readSources;
        const profile = createThemeProfiles([name], sources)[0];
        expect(profile, `${name} must resolve to a profile`).toBeDefined();
        if (!profile) {
          return;
        }

        const rule = findTopLevelRule(profile.root, profile.selector);
        expect(
          rule,
          `${profile.name} must declare ${profile.selector}`
        ).toBeDefined();
        if (!rule) {
          return;
        }

        const properties = Arr.flatMap(rule.nodes, (node) =>
          node.type === "decl" ? [node.prop] : []
        );
        const coreProperties = Arr.filter(properties, (property) =>
          Arr.contains(REQUIRED_THEME_TOKENS, property)
        );
        const unexpectedProperties = Arr.filter(
          properties,
          (property) =>
            !(
              Arr.contains(REQUIRED_THEME_TOKENS, property) ||
              Arr.contains(THEME_METADATA_PROPERTIES, property)
            )
        );

        expect(Arr.sort(coreProperties, Order.String)).toEqual(
          Arr.sort(REQUIRED_THEME_TOKENS, Order.String)
        );
        expect(unexpectedProperties).toEqual([]);
      })
  );
  it.effect.each(concreteThemeNames)(
    "$name owns its concrete color scheme",
    (name) =>
      Effect.gen(function* () {
        const sources = yield* readSources;
        const profile = createThemeProfiles([name], sources)[0];
        expect(profile, `${name} must resolve to a profile`).toBeDefined();
        if (!profile) {
          return;
        }

        const rule = findTopLevelRule(profile.root, profile.selector);
        expect(rule).toBeDefined();
        if (!rule) {
          return;
        }
        const definition = Arr.findFirst(
          themes,
          (theme) => theme.value === profile.name
        );
        expect(Option.isSome(definition)).toBe(true);
        if (Option.isNone(definition)) {
          return;
        }
        const colorSchemes = Arr.flatMap(rule.nodes, (node) =>
          node.type === "decl" && node.prop === "color-scheme"
            ? [node.value.trim()]
            : []
        );
        expect(colorSchemes).toEqual([definition.value.appearance]);
      })
  );
  it.effect("maps every status pair into Tailwind's inline theme", () =>
    Effect.gen(function* () {
      const sources = yield* readSources;
      const inlineTheme = findInlineTheme(sources.globals);
      expect(inlineTheme).toBeDefined();
      if (!inlineTheme) {
        return;
      }
      for (const status of STATUS_NAMES) {
        expect(readDirectValue(inlineTheme, `--color-${status}`)).toBe(
          `var(--${status})`
        );
        expect(
          readDirectValue(inlineTheme, `--color-${status}-foreground`)
        ).toBe(`var(--${status}-foreground)`);
      }
    })
  );
});
