import { Particles } from "@repo/design-system/components/ui/particles";

export const card = {
  name: "Particles",
  group: "Identity",
  height: 220,
  source: "particles",
};

/** The card's live example. */
export function Preview() {
  return (
    <div className="relative h-55 overflow-hidden">
      <Particles className="absolute inset-0" quantity={120} />
      <div className="relative flex h-full flex-col items-center justify-center gap-1">
        <p className="text-2xl font-semibold">Learn anything, for free.</p>
        <p className="text-muted-foreground text-sm">Learn until it clicks.</p>
      </div>
    </div>
  );
}
