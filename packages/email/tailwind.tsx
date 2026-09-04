import { THEME_COMPATIBILITY_COLORS } from "@repo/design-system/lib/theme/compatibility";
import type { ReactNode } from "react";
import type { TailwindConfig } from "react-email";
import { pixelBasedPreset, Tailwind as ReactEmailTailwind } from "react-email";

const emailThemeColors = THEME_COMPATIBILITY_COLORS.light;

const tailwindConfig = {
  presets: [pixelBasedPreset],
  theme: {
    extend: {
      colors: {
        background: emailThemeColors.background,
        foreground: emailThemeColors.foreground,
        primary: {
          DEFAULT: emailThemeColors.primary,
          foreground: emailThemeColors["primary-foreground"],
        },
        "muted-foreground": emailThemeColors["muted-foreground"],
        border: emailThemeColors.border,
      },
      borderRadius: {
        md: "6px",
      },
      fontSize: {
        xs: "12px",
        sm: "14px",
        base: "16px",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          '"Helvetica Neue"',
          "Ubuntu",
          "sans-serif",
        ],
      },
    },
  },
} satisfies TailwindConfig;

/** Applies Nakafa's shared React Email Tailwind theme. */
export function Tailwind({ children }: { children: ReactNode }) {
  return (
    <ReactEmailTailwind config={tailwindConfig}>{children}</ReactEmailTailwind>
  );
}
