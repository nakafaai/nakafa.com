import { MoonStarIcon } from "lucide-react";
import { createElement } from "react";

export const holyMenu = [
  {
    title: "quran",
    icon: createElement(MoonStarIcon),
    href: "/quran",
  },
] as const;
