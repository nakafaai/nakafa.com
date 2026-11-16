import { Thing } from "@repo/design-system/components/ui/thing";
import { ThingNameSchema } from "@repo/mascot/thing/name";
import { Array as Arr } from "effect";

export const card = {
  name: "Thing",
  group: "Identity",
  height: 260,
  source: "components/ui/thing",
};

/** Every thing Nina and the animals hold, in the order of the thing catalog. */
export function Preview() {
  return (
    <div className="flex flex-wrap gap-4 p-6">
      {Arr.map(ThingNameSchema.literals, (name) => (
        <Thing key={name} name={name} size={40} />
      ))}
    </div>
  );
}
