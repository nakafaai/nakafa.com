import { EMAIL_COLORS, EMAIL_FONTS } from "@repo/email/brand";
import type { ReactNode } from "react";
import type { TailwindConfig } from "react-email";
import { pixelBasedPreset, Tailwind as ReactEmailTailwind } from "react-email";

const { dark, light } = EMAIL_COLORS;

/** One design-system color in both themes: `bg-primary` for light, `dark:bg-primary-dark` for dark. */
const tailwindConfig = {
  presets: [pixelBasedPreset],
  theme: {
    extend: {
      colors: {
        background: { DEFAULT: light.background, dark: dark.background },
        foreground: { DEFAULT: light.foreground, dark: dark.foreground },
        primary: {
          DEFAULT: light.primary,
          dark: dark.primary,
          foreground: light["primary-foreground"],
          "foreground-dark": dark["primary-foreground"],
        },
        "muted-foreground": {
          DEFAULT: light["muted-foreground"],
          dark: dark["muted-foreground"],
        },
        border: { DEFAULT: light.border, dark: dark.border },
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
        sans: EMAIL_FONTS,
      },
    },
  },
} satisfies TailwindConfig;

/** Applies Nakafa's shared React Email Tailwind theme, light and dark. */
export function Tailwind({ children }: { children: ReactNode }) {
  return (
    <ReactEmailTailwind config={tailwindConfig}>{children}</ReactEmailTailwind>
  );
}
