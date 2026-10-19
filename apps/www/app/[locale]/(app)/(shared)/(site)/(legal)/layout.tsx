import { monospace } from "@repo/design-system/lib/monospace";
import { cn } from "cn";

/**
 * The privacy policy shows inline code in Geist Mono, so every legal page
 * carries the face. The terms pages show no code and share this layout.
 */
export default function Layout({ children }: LayoutProps<"/[locale]">) {
  return <div className={cn(monospace, "contents")}>{children}</div>;
}
