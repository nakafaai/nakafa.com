import { createCalculator } from "@repo/ai/agents/math/tools/calculator";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { UIMessageStreamWriter } from "ai";

interface Params {
  writer: UIMessageStreamWriter<MyUIMessage>;
}

export function mathTools({ writer }: Params) {
  return {
    calculator: createCalculator({ writer }),
  };
}
