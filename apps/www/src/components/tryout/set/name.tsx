import { cn } from "cn";
import { Array as Arr, Schema } from "effect";
import { useTranslations } from "use-intl";
import { useLiveSession } from "@/components/providers/live";

/** Every name a try-out action can carry, which share its one cell. */
const TryoutActionNameSchema = Schema.Literals([
  "start-cta",
  "continue-cta",
  "restart-cta",
]);

export type TryoutActionNameKey = typeof TryoutActionNameSchema.Type;

/**
 * The name on a try-out action. Every name holds the same cell, so the button keeps the width of the
 * longest one and the header stays still when the name arrives. No first paint knows a learner's
 * attempt, and a static page paints the same HTML for everyone, so a name that is `pending` reads as
 * it is for a visitor and stays hidden under a signed-in hint (`globals.css`) until the learner read
 * answers: a running attempt never reads Start. A session that could not be read answers nothing, so
 * the name then shows.
 */
export function TryoutActionName({
  name,
  pending = false,
}: {
  readonly name: TryoutActionNameKey;
  /** The learner read that decides this name has not answered yet. */
  readonly pending?: boolean;
}) {
  const t = useTranslations("Tryouts");
  const failed = useLiveSession((state) => state.hasError);
  return (
    <span
      className="grid"
      data-learner-read={pending && !failed ? "pending" : undefined}
      data-slot="tryout-action-name"
    >
      {Arr.map(TryoutActionNameSchema.literals, (key) => (
        <span
          className={cn("col-start-1 row-start-1", key !== name && "invisible")}
          key={key}
        >
          {t(key)}
        </span>
      ))}
    </span>
  );
}
