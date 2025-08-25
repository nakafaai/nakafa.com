import { Particles } from "@repo/design-system/components/ui/particles";
import { AuthGoogle } from "@/components/auth/google";

export default function Page() {
  return (
    <div
      className="relative flex h-[calc(100svh-4rem)] items-center justify-center lg:h-svh"
      data-pagefind-ignore
    >
      <Particles className="pointer-events-none absolute inset-0 opacity-80" />
      <AuthGoogle />
    </div>
  );
}
