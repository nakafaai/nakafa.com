import type { ReactNode } from "react";
import { ConvexAppProviders } from "@/components/providers";

/** Renders the auth route inside the ambient Convex/user providers. */
export default function Layout({ children }: { children: ReactNode }) {
  return <ConvexAppProviders>{children}</ConvexAppProviders>;
}
