import { Textarea } from "@repo/design-system/components/ui/textarea";

export const card = {
  name: "Textarea",
  group: "Forms",
  height: 150,
  source: "textarea",
};

/** The card's live example. */
export function Preview() {
  return (
    <div className="max-w-md p-6">
      <Textarea
        aria-label="Question"
        minRows={3}
        placeholder="Ask Nina anything..."
      />
    </div>
  );
}
