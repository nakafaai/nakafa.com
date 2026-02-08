import type { themes } from "@repo/design-system/lib/theme";

export type Theme = (typeof themes)[number]["value"];
