import { Slider } from "@repo/design-system/components/ui/slider";

export const card = {
  name: "Slider",
  group: "Forms",
  height: 110,
  source: "slider",
};

/** The card's live example. */
export function Preview() {
  return (
    <div className="flex max-w-sm flex-col gap-6 p-6">
      <Slider aria-label="Launch angle" defaultValue={45} max={90} />
      <Slider aria-label="Score range" defaultValue={[40, 80]} />
    </div>
  );
}
