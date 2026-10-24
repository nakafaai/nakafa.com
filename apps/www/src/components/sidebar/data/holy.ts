import { AllahIcon } from "@hugeicons/core-free-icons";
import { linkOptions } from "@tanstack/react-router";
import { LOCALE_ROUTE } from "@/lib/routing/tree";

export const holyMenu = [
  {
    title: "quran",
    icon: AllahIcon,
    target: linkOptions({ from: LOCALE_ROUTE, to: "/$locale/quran" }),
  },
] as const;
