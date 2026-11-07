import { THEME_COMPATIBILITY_COLORS } from "@repo/design-system/lib/theme/compatibility";
import {
  COMPANY_IDENTITY,
  COMPANY_REGISTERED_ADDRESS,
} from "@repo/seo/company";
import { SITE_ORIGIN } from "@repo/seo/origin";

/** The Nakafa mark every email opens with, on its own white field in either theme. */
export const EMAIL_LOGO_URL = new URL("/logo.png", SITE_ORIGIN).href;

/**
 * The design system's colors an email paints with, light and dark, as the sRGB
 * projection mail clients read. A client that follows the reader's dark theme
 * takes the dark set; any other keeps the light one.
 */
export const EMAIL_COLORS = {
  dark: THEME_COMPATIBILITY_COLORS.dark,
  light: THEME_COMPATIBILITY_COLORS.light,
};

/** Inter where the reader has it, then each platform's own interface face. */
export const EMAIL_FONTS = [
  "Inter",
  "-apple-system",
  "BlinkMacSystemFont",
  '"Segoe UI"',
  "Roboto",
  '"Helvetica Neue"',
  "Ubuntu",
  "sans-serif",
];

/** Who sends every email, where it is registered, and where a reader reaches Nakafa. */
export const EMAIL_SENDER = {
  address: COMPANY_REGISTERED_ADDRESS,
  contact: COMPANY_IDENTITY.email,
  name: COMPANY_IDENTITY.legalName,
};
