import { Picture } from "@repo/design-system/components/ui/picture";

const shapes = [
  { _tag: "rect", fill: "#2f7b6e", height: 100, width: 100, x: 0, y: 0 },
  { _tag: "circle", cx: 50, cy: 42, fill: "#f7d774", r: 22 },
  { _tag: "path", d: "M10 100 Q50 52 90 100 Z", fill: "#f6f4ef" },
] as const;

export const card = {
  name: "Picture",
  group: "Identity",
  height: 190,
  source: "components/ui/picture",
};

/** The card's live example. */
export function Preview() {
  return (
    <div className="flex flex-wrap items-end gap-6 p-6">
      <Picture
        box={[0, 0, 100, 100]}
        label="A sun over a hill"
        marked={() => ({})}
        shapes={shapes}
        size={120}
      />
      <Picture
        box={[0, 0, 100, 100]}
        marked={() => ({})}
        shapes={shapes}
        size={64}
      />
      <Picture
        box={[-50, 0, 200, 100]}
        marked={() => ({})}
        shapes={shapes}
        size={160}
      />
    </div>
  );
}
