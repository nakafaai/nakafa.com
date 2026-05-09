import { defaultLocale, locales } from "@repo/utilities/locales";
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales,
  defaultLocale,
});
