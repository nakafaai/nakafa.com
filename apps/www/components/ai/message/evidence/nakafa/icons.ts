import {
  File02Icon,
  Folder02Icon,
  Quran02Icon,
  Search02Icon,
} from "@hugeicons/core-free-icons";
import type { NakafaDataPart } from "@repo/backend/confect/nina/contract/data";

/**
 * The icon of each kind of Nakafa step, in every state but a failure. None is
 * the open book of the Nakafa activity above it, so a step never repeats its
 * activity's icon.
 */
export const nakafaIcons = {
  content: File02Icon,
  quran: Quran02Icon,
  search: Search02Icon,
  taxonomy: Folder02Icon,
} satisfies Record<NakafaDataPart["kind"], typeof File02Icon>;
