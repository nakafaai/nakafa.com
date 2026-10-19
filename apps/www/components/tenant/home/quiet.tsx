import { Nina } from "@repo/design-system/components/ui/nina";
import type { ActSchema } from "@repo/mascot/nina/act";

/**
 * The quiet state of a home with nothing to list: Nina doing one act beside one sentence, with no card, since a
 * card that only tells would hold no action. Its sentence line keeps its height while it is empty, so the state
 * holds the place of the tiles while their rows load.
 */
export function QuietState({
  act,
  children,
}: {
  act: typeof ActSchema.Type;
  children: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <Nina act={act} label="" size={48} whole />
      <p className="min-h-5 text-muted-foreground text-sm">{children}</p>
    </div>
  );
}
