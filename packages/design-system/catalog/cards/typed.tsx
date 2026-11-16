import { TypedText } from "@repo/design-system/components/ui/typed";

export const card = {
  name: "TypedText",
  group: "Identity",
  height: 170,
  source: "typed",
};

/** The card's live example. */
export function Preview() {
  return (
    <div className="grid gap-6 p-6 text-lg">
      <div className="grid gap-1">
        <TypedText caret playing step={30} text="Learn until it makes sense." />
      </div>
      <div className="grid gap-1">
        <TypedText
          caret
          initial="written"
          playing={false}
          step={30}
          text="Every letter is already written."
        />
      </div>
    </div>
  );
}
