import { LayoutMaterial } from "@/components/shared/layout-material";
import type { ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
  return <LayoutMaterial>{children}</LayoutMaterial>;
}
