import { TypingLoader } from "@repo/design-system/components/ui/typing-loader";

export const card = {
  name: "TypingLoader",
  group: "Feedback",
  height: 110,
  source: "typing-loader",
};

/** The card's live example. */
export function Preview() {
  return (
    <div className="flex items-center gap-8 p-6">
      <TypingLoader size="sm" />
      <TypingLoader />
      <TypingLoader size="lg" />
    </div>
  );
}
