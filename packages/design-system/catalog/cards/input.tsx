import { Input } from "@repo/design-system/components/ui/input";

export const card = {
  name: "Input",
  group: "Forms",
  height: 240,
  source: "components/ui/input",
};

/** The card's live example. */
export function Preview() {
  return (
    <div className="flex max-w-sm flex-col gap-3 p-6">
      <Input aria-label="Name" placeholder="Your name" />
      <Input
        aria-label="Email"
        defaultValue="learner@nakafa.com"
        placeholder="you@example.com"
        type="email"
      />
      <Input
        aria-invalid
        aria-label="Class code"
        defaultValue="ABC"
        placeholder="Six characters"
      />
      <Input aria-label="Disabled field" disabled placeholder="Disabled" />
    </div>
  );
}
