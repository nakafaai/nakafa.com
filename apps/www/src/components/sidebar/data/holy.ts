import { AllahIcon } from "@hugeicons/core-free-icons";
import type { LinkTarget } from "@/lib/routing/link";

import { LOCALE_ROUTE } from "@/lib/routing/tree";

export const holyMenu = [
  {
    title: "quran",
    icon: AllahIcon,
    target: { from: LOCALE_ROUTE, to: "/$locale/quran" } satisfies LinkTarget,
  },
] as const;
