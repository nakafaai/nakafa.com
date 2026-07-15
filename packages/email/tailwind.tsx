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
        card: emailThemeColors.card,
        "card-foreground": emailThemeColors["card-foreground"],
        popover: emailThemeColors.popover,
        "popover-foreground": emailThemeColors["popover-foreground"],
        primary: {
          DEFAULT: emailThemeColors.primary,
          foreground: emailThemeColors["primary-foreground"],
        },
        secondary: {
          DEFAULT: emailThemeColors.secondary,
          foreground: emailThemeColors["secondary-foreground"],
        },
        destructive: {
          DEFAULT: emailThemeColors.destructive,
          foreground: emailThemeColors["destructive-foreground"],
        },
        success: {
          DEFAULT: emailThemeColors.success,
          foreground: emailThemeColors["success-foreground"],
        },
        warning: {
          DEFAULT: emailThemeColors.warning,
          foreground: emailThemeColors["warning-foreground"],
        },
        info: {
          DEFAULT: emailThemeColors.info,
          foreground: emailThemeColors["info-foreground"],
        },
        muted: {
          DEFAULT: emailThemeColors.muted,
          foreground: emailThemeColors["muted-foreground"],
        },
        accent: {
          DEFAULT: emailThemeColors.accent,
          foreground: emailThemeColors["accent-foreground"],
        },
        border: emailThemeColors.border,
        input: emailThemeColors.input,
        ring: emailThemeColors.ring,
      },
      borderRadius: {
        md: "6px",
        lg: "8px",
        xl: "12px",
      },
      fontSize: {
        xs: "12px",
        sm: "14px",
        base: "16px",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(0, 0, 0, 0.05)",
        DEFAULT: "0 1px 4px rgba(0, 0, 0, 0.05)",
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
