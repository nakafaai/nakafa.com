import { Particles } from "@repo/design-system/components/ui/particles";
export default function Layout({
  children,
}: LayoutProps<"/[locale]/school/onboarding">) {
  return (
    <main className="relative flex min-h-svh">
      <Particles className="pointer-events-none absolute inset-0 -z-1 opacity-80" />
      {children}
    </main>
  );
}
