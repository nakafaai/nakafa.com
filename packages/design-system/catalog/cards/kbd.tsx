import { Kbd, KbdGroup } from "@repo/design-system/components/ui/kbd";

export const card = {
  name: "Kbd",
  group: "Content",
  height: 150,
  source: "kbd",
};

/** The card's live example. */
export function Preview() {
  return (
    <div className="grid gap-4 p-6 text-sm">
      <p>
        Press <Kbd>Esc</Kbd> to close the panel.
      </p>
      <div className="flex items-center justify-between gap-4">
        <span>Open search</span>
        <KbdGroup>
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span>Next question</span>
        <KbdGroup>
          <Kbd>→</Kbd>
        </KbdGroup>
      </div>
    </div>
  );
}
