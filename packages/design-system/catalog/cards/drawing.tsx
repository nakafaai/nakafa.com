import { Drawing } from "@repo/design-system/components/ui/drawing";

const sun = { _tag: "circle", cx: 50, cy: 50, fill: "#f7d774", r: 30 } as const;
const hill = {
  _tag: "path",
  d: "M8 92 Q50 40 92 92 Z",
  fill: "#2f7b6e",
} as const;
const scene = { _tag: "g", children: [hill, sun] } as const;

export const card = {
  name: "Drawing",
  group: "Identity",
  height: 150,
  source: "components/ui/drawing",
};

/** The card's live example. */
export function Preview() {
  return (
    <div className="flex flex-wrap items-center gap-6 p-6">
      <svg aria-hidden className="size-24" viewBox="0 0 100 100">
        <Drawing marked={() => ({})} shape={sun} />
      </svg>
      <svg aria-hidden className="size-24" viewBox="0 0 100 100">
        <Drawing marked={() => ({})} shape={scene} />
      </svg>
    </div>
  );
}
