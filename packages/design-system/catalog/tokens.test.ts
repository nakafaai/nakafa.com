// @vitest-environment node

import { NodeFileSystem } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect, FileSystem } from "effect";
import postcss from "postcss";
import { readTokens } from "#catalog/tokens";

const root = `${import.meta.dirname}/..`;

const parse = (path: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    return postcss.parse(yield* fs.readFileString(path), { from: path });
  }).pipe(Effect.provide(NodeFileSystem.layer));

const scale = postcss.parse(`@theme default {
  --spacing: 0.25rem;
  --text-xs: 0.75rem;
  --text-xs--line-height: calc(1 / 0.75);
  --text-sm: 0.875rem;
  --text-sm--line-height: calc(1.25 / 0.875);
  --text-base: 1rem;
  --text-base--line-height: calc(1.5 / 1);
  --text-xl: 1.25rem;
  --text-xl--line-height: calc(1.75 / 1.25);
  --text-2xl: 1.5rem;
  --text-2xl--line-height: calc(2 / 1.5);
  --text-4xl: 2.25rem;
  --text-4xl--line-height: calc(2.5 / 2.25);
  --text-5xl: 3rem;
  --text-5xl--line-height: 1;
}`);

const identity = postcss.parse(`@theme static {
  /* Nina's body. */
  --color-nina-body: #8ad;
}`);

const globals = (light: string, dark: string) =>
  postcss.parse(`:root {
  /* The page ground. */
  --background: oklch(1 0 0);
  ${light}
  /* The base radius. */
  --radius: 1rem;
  /* A card's lift. */
  --shadow-xs: 0px 1px 4px 0px hsl(0 0% 0% / 0.03);
}
.dark {
  --background: oklch(0.15 0.02 260);
  ${dark}
}
@theme {
  /* Motion that enters. */
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  /* A press. */
  --transition-duration-press: 120ms;
}
@theme inline {
  --text-chat: 15px;
  --text-chat--line-height: 1.625;
  /* Controls. */
  --radius-md: calc(var(--radius) - 2px);
  /* Cards. */
  --radius-xl: calc(var(--radius) + 4px);
  /* The base. */
  --radius-lg: var(--radius);
}`);

describe("readTokens", () => {
  it.effect(
    "reads every token of the design system's stylesheets with what it is for",
    () =>
      Effect.gen(function* () {
        const tokens = yield* readTokens(
          yield* parse(`${root}/styles/globals.css`),
          yield* parse(`${root}/styles/identity.css`),
          yield* parse(`${root}/node_modules/tailwindcss/theme.css`)
        );
        const names = Arr.map(tokens.color.tokens, (token) => token.name);
        expect(names).toContain("primary");
        expect(names).toContain("nina-body");
        expect(
          Arr.every(
            tokens.color.tokens,
            (token) => token.usage !== "" && token.value.dark !== ""
          )
        ).toBe(true);
      })
  );

  it.effect(
    "computes radii, type styles, spacing and motion from their declarations",
    () =>
      Effect.gen(function* () {
        const tokens = yield* readTokens(globals("", ""), identity, scale);
        expect(tokens.color.tokens[0]).toEqual({
          name: "background",
          value: { light: "oklch(1 0 0)", dark: "oklch(0.15 0.02 260)" },
          usage: "The page ground.",
        });
        expect(tokens.color.tokens[1]).toEqual({
          name: "nina-body",
          value: { light: "#8ad", dark: "#8ad" },
          usage: "Nina's body.",
        });
        expect(Arr.map(tokens.radius.tokens, (token) => token.value)).toEqual([
          "14px",
          "20px",
          "16px",
          "9999px",
        ]);
        expect(tokens.type.groups[0]?.styles[1]).toMatchObject({
          name: "text-sm",
          fontSize: "14px",
          lineHeight: "1.429",
        });
        expect(tokens.type.groups[2]?.styles[1]).toMatchObject({
          name: "text-5xl",
          lineHeight: "1",
        });
        expect(tokens.spacing.tokens[0]).toMatchObject({
          name: "space-1",
          value: "4px",
        });
        expect(tokens.shadow.tokens[0]?.name).toBe("shadow-xs");
        expect(tokens.easing.tokens[0]?.value).toBe(
          "cubic-bezier(0.23, 1, 0.32, 1)"
        );
        expect(tokens.duration.tokens[0]?.value).toBe("120ms");
      })
  );

  it.effect(
    "refuses a token without the comment that says what it is for",
    () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(
          readTokens(
            globals(
              "--ring: oklch(0.3 0.07 262);",
              "--ring: oklch(0.7 0.1 224);"
            ),
            identity,
            scale
          )
        );
        expect(error.message).toContain("--ring needs a comment");
      })
  );

  it.effect("refuses a foreground whose comment does not name its ground", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        readTokens(
          globals(
            "/* Text on the brand fill. */\n  --primary-foreground: white;",
            "--primary-foreground: white;"
          ),
          identity,
          scale
        )
      );
      expect(error.message).toContain(
        "--primary-foreground needs its ground named in its comment, as `primary`"
      );
    })
  );

  it.effect("accepts a foreground whose comment names its ground", () =>
    Effect.gen(function* () {
      const tokens = yield* readTokens(
        globals(
          "/* Text on `primary`. */\n  --primary-foreground: white;",
          "--primary-foreground: white;"
        ),
        identity,
        scale
      );
      expect(Arr.map(tokens.color.tokens, (token) => token.name)).toContain(
        "primary-foreground"
      );
    })
  );

  it.effect("refuses a light token the dark theme does not declare", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        readTokens(
          globals("/* The focus ring. */\n  --ring: oklch(0.3 0.07 262);", ""),
          identity,
          scale
        )
      );
      expect(error.message).toBe(".dark declares no --ring.");
    })
  );

  it.effect(
    "reads no identity colors from an identity theme without a body",
    () =>
      Effect.gen(function* () {
        const tokens = yield* readTokens(
          globals("", ""),
          postcss.parse("@theme static;"),
          scale
        );
        expect(Arr.map(tokens.color.tokens, (token) => token.name)).toEqual([
          "background",
        ]);
      })
  );

  it.effect("refuses a scale without a step the type styles read", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        readTokens(
          globals("", ""),
          identity,
          postcss.parse("@theme default { --spacing: 0.25rem; }")
        )
      );
      expect(error.message).toBe("Tailwind's theme declares no --text-xs.");
    })
  );

  it.effect("refuses a stylesheet without one of its token blocks", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        readTokens(postcss.parse(":root {}"), identity, scale)
      );
      expect(error.message).toBe("The stylesheet has no .dark block.");
    })
  );
});
