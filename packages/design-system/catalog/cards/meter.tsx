import { Meter } from "@repo/design-system/components/ui/meter";

export const card = {
  name: "Meter",
  group: "Feedback",
  height: 120,
  source: "components/ui/meter",
};

/** How much of a whole is done: a lesson read, a storage quota used. */
export function Preview() {
  return (
    <div className="flex max-w-sm flex-col gap-4 p-6">
      <Meter label="Lesson read" percent={64} />
      <Meter label="Storage used" percent={18} />
    </div>
  );
}
