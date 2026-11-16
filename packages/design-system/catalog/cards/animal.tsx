import { Animal } from "@repo/design-system/components/ui/animal";
import { Animal as Animals } from "@repo/mascot/animal";
import { groundsOf } from "@repo/mascot/seed";
import { Array as Arr } from "effect";

export const card = {
  name: "Animal",
  group: "Identity",
  height: 760,
  source: "components/ui/animal",
};

/** Every animal a person can be, each in its first palette on the first ground its body stands out from. */
export function Preview() {
  return (
    <div className="flex flex-wrap gap-3 p-6">
      {Arr.map(Animals.literals, (animal) => (
        <div
          className="size-14 overflow-hidden rounded-full"
          key={animal}
          title={animal}
        >
          <Animal
            mascot={{
              animal,
              eyes: "open",
              ground: Arr.getUnsafe(groundsOf(animal, 0), 0),
              palette: 0,
              pose: "center",
            }}
          />
        </div>
      ))}
    </div>
  );
}
