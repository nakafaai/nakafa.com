import { Medal } from "@repo/design-system/components/ui/medal";
import { MedalSchema } from "@repo/mascot/medal/name";
import { Array as Arr } from "effect";

export const card = {
  name: "Medal",
  group: "Identity",
  height: 420,
  source: "components/ui/medal",
};

/** Every medal at its first tier, and the first medal from still to earn up through its tiers. */
export function Preview() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-end gap-3">
        {Arr.map([0, 1, 2, 3], (tier) => (
          <Medal className="w-14" key={tier} name="days" tier={tier} />
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {Arr.map(MedalSchema.literals, (name) => (
          <Medal className="w-10" key={name} name={name} tier={1} />
        ))}
      </div>
    </div>
  );
}
