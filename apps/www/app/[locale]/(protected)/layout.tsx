import type { ReactNode } from "react";
import { ConvexProvider } from "@/components/providers/convex";

export default function Layout({ children }: { children: ReactNode }) {
  return <ConvexProvider>{children}</ConvexProvider>;
}
