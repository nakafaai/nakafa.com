import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@repo/design-system/components/ai/reasoning";

export const card = {
  name: "Reasoning",
  group: "Chat",
  height: 200,
  source: "components/ai/reasoning",
};

/** How Nina thought before she answered, folded under one row the learner may open. */
export function Preview() {
  return (
    <div className="max-w-xl p-6">
      <Reasoning defaultOpen duration={4} hasContent>
        <ReasoningTrigger />
        <ReasoningContent>
          <p className="text-muted-foreground text-sm">
            The learner asks for the vertex. Completing the square gives (x −
            2)² − 1, so the vertex is (2, −1).
          </p>
        </ReasoningContent>
      </Reasoning>
    </div>
  );
}
