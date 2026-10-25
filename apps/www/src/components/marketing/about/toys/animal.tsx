import { PersonAvatar } from "@repo/design-system/components/ui/person";
import { Array as Arr } from "effect";
import type { TOY_HERD } from "@/components/marketing/about/toys/herd";

/** An animal of a herd at its index, drawn round at the size of a toy. */
export function ToyAnimal({
  herd,
  index,
}: {
  herd: typeof TOY_HERD;
  index: number;
}) {
  return (
    <PersonAvatar className="size-14" mascot={Arr.getUnsafe(herd, index)} />
  );
}
