import { AllahIcon } from "@hugeicons/core-free-icons";
import { LOCALE_ROUTE } from "@repo/internationalization/src/link";
import { linkOptions } from "@tanstack/react-router";

export const holyMenu = [
  {
    title: "quran",
    icon: AllahIcon,
    target: linkOptions({ from: LOCALE_ROUTE, to: "/$locale/quran" }),
  },
] as const;
