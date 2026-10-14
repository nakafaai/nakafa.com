import { Animal } from "@repo/design-system/components/ui/animal";
import { forSeed } from "@repo/mascot/seed";
import { cn } from "cn";

interface Props {
  className?: string;
  name: string;
}

/**
 * The profile animal of one person, in a round frame. The animal follows the
 * seed in `name`, so the same name always shows the same animal.
 */
export function Character({ name, className }: Props) {
  return (
    <Animal
      className={cn("rounded-full border", className)}
      mascot={forSeed(name)}
    />
  );
}
