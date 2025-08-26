import type { ReactNode } from "react";
import { ConvexClientProvider } from "./client";

export function ConvexProvider({ children }: { children: ReactNode }) {
  return <ConvexClientProvider>{children}</ConvexClientProvider>;
}
