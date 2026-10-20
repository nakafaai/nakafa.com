import { EmptyMedia } from "@repo/design-system/components/ui/empty";
import { Nina } from "@repo/design-system/components/ui/nina";
import type { ActSchema } from "@repo/mascot/nina/act";

/** How wide Nina stands in an empty state. */
const EMPTY_NINA_SIZE = 96;

/** The mascot of an empty state, doing what fits the place. */
export function EmptyNina({ act }: { act: typeof ActSchema.Type }) {
  return (
    <EmptyMedia>
      <Nina act={act} label="" size={EMPTY_NINA_SIZE} whole />
    </EmptyMedia>
  );
}
