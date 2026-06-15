import { Particles } from "@repo/design-system/components/ui/particles";

/** Provides the focused first-run shell for normal Nakafa onboarding routes. */
export default function Layout({
  children,
}: LayoutProps<"/[locale]/onboarding">) {
  return (
    <main className="relative flex min-h-svh w-full">
      <Particles className="pointer-events-none absolute inset-0 -z-1 opacity-80" />
      {children}
    </main>
  );
}
