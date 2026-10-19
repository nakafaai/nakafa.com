import { Nina } from "@repo/design-system/components/ui/nina";
import type { ActSchema } from "@repo/mascot/nina/act";

/**
 * The quiet state of a home with nothing to list: Nina doing one act beside one sentence, with no card, since a
 * card that only tells would hold no action. A home shows it only once its reads have answered, so its sentence
 * is always a real one.
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
      <p className="text-muted-foreground text-sm">{children}</p>
    </div>
  );
}
