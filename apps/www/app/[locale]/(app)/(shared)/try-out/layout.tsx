import { TryoutShell } from "@/components/tryout/shell";

/** Renders the shared tryout shell for every route in the tryout subtree. */
export default function Layout({ children }: LayoutProps<"/[locale]/try-out">) {
  return <TryoutShell>{children}</TryoutShell>;
}
