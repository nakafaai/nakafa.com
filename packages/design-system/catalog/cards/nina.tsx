import { Nina } from "@repo/design-system/components/ui/nina";
import { ActSchema } from "@repo/mascot/nina/act";
import { EdgeSchema } from "@repo/mascot/nina/edge";
import { MoodSchema } from "@repo/mascot/nina/face";
import { Array as Arr } from "effect";

export const card = {
  name: "Nina",
  group: "Identity",
  height: 900,
  source: "components/ui/nina",
};

/** Every act of Nina's whole figure, every act at an edge, and every mood in her tile. */
export function Preview() {
  return (
    <div className="grid gap-6 p-6">
      <div className="flex flex-wrap items-end gap-4">
        {Arr.map(ActSchema.literals, (act) => (
          <Nina act={act} key={act} label={act} size={96} whole />
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-6">
        {Arr.map(EdgeSchema.literals, (act) => (
          <Nina act={act} key={act} label={act} lean="peek" size={96} />
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        {Arr.map(MoodSchema.literals, (mood) => (
          <Nina key={mood} label={mood} mood={mood} size={56} tile="blue" />
        ))}
      </div>
    </div>
  );
}
