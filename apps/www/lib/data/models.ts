import type { ModelId } from "@repo/ai/lib/providers";
import { BackpackIcon, type LucideIcon, ZapIcon } from "lucide-react";

export const models: { icon: LucideIcon; value: ModelId }[] = [
  {
    icon: BackpackIcon,
    value: "standard",
  },
  {
    icon: ZapIcon,
    value: "pro",
  },
];
