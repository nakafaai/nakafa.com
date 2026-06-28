import type { ReactNode } from "react";
import type { TailwindConfig } from "react-email";
import { pixelBasedPreset, Tailwind as ReactEmailTailwind } from "react-email";

const tailwindConfig = {
  presets: [pixelBasedPreset],
  theme: {
    extend: {
      colors: {
        background: "#FFFFFF",
        foreground: "#111827",
        card: "#FFFFFF",
        "card-foreground": "#111827",
        popover: "#FFFFFF",
        "popover-foreground": "#111827",
        primary: {
          DEFAULT: "#d87943",
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "#527575",
          foreground: "#FFFFFF",
        },
        destructive: {
          DEFAULT: "#ef4444",
          foreground: "#FFFFFF",
        },
        muted: {
          DEFAULT: "#f3f4f6",
          foreground: "#6b7280",
        },
        accent: {
          DEFAULT: "#eeeeee",
          foreground: "#111827",
        },
        border: "#e5e7eb",
        input: "#e5e7eb",
        ring: "#d87943",
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
