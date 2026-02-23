import type { MyUIMessage } from "@repo/ai/types/message";
import type { UIMessageStreamWriter } from "ai";
import { createCalculator } from "./tools/calculator";

interface Params {
  writer: UIMessageStreamWriter<MyUIMessage>;
}

export function mathTools({ writer }: Params) {
  return {
    calculator: createCalculator({ writer }),
  };
}
