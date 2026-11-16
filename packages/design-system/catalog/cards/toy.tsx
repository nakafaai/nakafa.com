import { Thing } from "@repo/design-system/components/ui/thing";
import { Toy, Toys } from "@repo/design-system/components/ui/toy";

export const card = {
  name: "Toy",
  group: "Identity",
  height: 260,
  source: "toy",
};

/** The card's live example. */
export function Preview() {
  return (
    <Toys className="bg-muted h-60 overflow-clip rounded-lg">
      <Toy className="top-6 left-6">
        <Thing name="book" size={56} />
      </Toy>
      <Toy className="top-10 left-36">
        <Thing name="pencil" size={56} />
      </Toy>
      <Toy className="top-24 right-10">
        <Thing name="balls" size={56} />
      </Toy>
      <Toy className="bottom-8 left-1/3">
        <Thing name="coffee" size={56} />
      </Toy>
    </Toys>
  );
}
