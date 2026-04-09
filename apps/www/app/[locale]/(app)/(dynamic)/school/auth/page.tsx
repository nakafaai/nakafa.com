import { Particles } from "@repo/design-system/components/ui/particles";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function Page() {
  return (
    <div
      className="relative flex h-svh items-center justify-center"
      data-pagefind-ignore
    >
      <Particles className="pointer-events-none absolute inset-0 opacity-80" />
      <div className="mx-auto w-full max-w-xl px-6">
        <ComingSoon />
      </div>
    </div>
  );
}
