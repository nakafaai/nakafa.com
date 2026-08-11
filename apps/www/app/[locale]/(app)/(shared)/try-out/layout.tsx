import { Suspense } from "react";
import { TryoutShell } from "@/components/tryout/shell/client";

/** Renders the shared tryout shell for every route in the tryout subtree. */
export default function Layout({ children }: LayoutProps<"/[locale]/try-out">) {
  return (
    <Suspense fallback={null}>
      <TryoutShell>{children}</TryoutShell>
    </Suspense>
  );
}
