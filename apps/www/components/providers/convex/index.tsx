import type { ReactNode } from "react";
import { ConvexClientProvider } from "./client";
import { ConvexServerProvider } from "./server";

export function ConvexProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexServerProvider>
      <ConvexClientProvider>{children}</ConvexClientProvider>
    </ConvexServerProvider>
  );
}
