import type { ReactNode } from "react";
import { LayoutMaterial } from "@/components/shared/layout-material";

export default function Layout({ children }: { children: ReactNode }) {
  return <LayoutMaterial>{children}</LayoutMaterial>;
}
