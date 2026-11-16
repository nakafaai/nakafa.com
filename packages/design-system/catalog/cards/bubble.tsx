import {
  Bubble,
  BubbleContent,
} from "@repo/design-system/components/ui/bubble";

export const card = {
  name: "Bubble",
  group: "Chat",
  height: 220,
  source: "components/ui/bubble",
};

/** The card's live example. */
export function Preview() {
  return (
    <div className="flex flex-col gap-3 p-6">
      <Bubble>
        <BubbleContent>Can you explain limits with an example?</BubbleContent>
      </Bubble>
      <Bubble variant="secondary">
        <BubbleContent>What is the derivative of sin x?</BubbleContent>
      </Bubble>
      <Bubble align="end" variant="muted">
        <BubbleContent>Thanks, that makes sense now.</BubbleContent>
      </Bubble>
    </div>
  );
}
