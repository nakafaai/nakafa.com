import { StopIcon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import type { PlayerCellModel } from "@/components/player/model";
import { PlayerGrid } from "@/components/player/navigator/grid";
import { usePlayer } from "@/components/player/provider";
import { readReview } from "@/components/player/review";

/**
 * The one primary action: a button that opens the review before it finishes
 * the questions. The review lists the flagged questions and the unanswered
 * ones, and picking a number closes it and goes to that question, once the
 * dialog has finished closing. Confirming keeps the dialog and the button as
 * they are until the page changes.
 */
export function PlayerFinish({
  description,
  label,
  locked,
  onFinish,
  pending,
  questions,
  title,
}: {
  description: string;
  /** The text of the button and of the confirmation. */
  label: string;
  /** Finishing is closed because time ran out. */
  locked: boolean;
  onFinish: () => void;
  /** The finish is on its way to the server. */
  pending: boolean;
  /** Every question, as the navigator marks it, in the frozen order. */
  questions: readonly PlayerCellModel[];
  title: string;
}) {
  const t = useTranslations("Player");
  const tCommon = useTranslations("Common");
  const overlay = usePlayer((state) => state.overlay);
  const waiting = usePlayer((state) => state.pending !== null);
  const open = usePlayer((state) => state.open);
  const close = usePlayer((state) => state.close);
  const settle = usePlayer((state) => state.settle);
  const review = readReview(questions);

  return (
    <>
      {/* Time running out closes the finish; a finish on its way only holds it still. */}
      <Button
        disabled={locked}
        inert={pending}
        onClick={() => open("finish")}
        type="button"
        variant="destructive"
      >
        <HugeIcons icon={StopIcon} />
        <span className="max-sm:sr-only">{label}</span>
      </Button>
      <ResponsiveDialog
        description={description}
        finalFocus={!waiting}
        footer={
          <>
            <Button onClick={close} type="button" variant="outline">
              {tCommon("cancel")}
            </Button>
            <Button
              disabled={locked}
              inert={pending}
              onClick={onFinish}
              type="button"
              variant="destructive"
            >
              <HugeIcons icon={StopIcon} />
              {label}
            </Button>
          </>
        }
        onOpenChangeComplete={(next) => {
          if (!next) {
            settle();
          }
        }}
        open={overlay === "finish"}
        setOpen={(next) => (next ? open("finish") : close())}
        title={title}
      >
        {Arr.isReadonlyArrayNonEmpty(review.flagged) ||
        Arr.isReadonlyArrayNonEmpty(review.unanswered) ? (
          <div className="grid gap-6">
            <PlayerReviewGroup
              heading={t("legend-flagged")}
              questions={review.flagged}
            />
            <PlayerReviewGroup
              heading={t("unanswered")}
              questions={review.unanswered}
            />
          </div>
        ) : null}
      </ResponsiveDialog>
    </>
  );
}

/** One group of the review: its heading and its numbers, or nothing when it has no question. */
function PlayerReviewGroup({
  heading,
  questions,
}: {
  heading: string;
  questions: readonly PlayerCellModel[];
}) {
  if (!Arr.isReadonlyArrayNonEmpty(questions)) {
    return null;
  }

  return (
    <section className="grid gap-3">
      <h3 className="font-medium text-sm">{heading}</h3>
      <PlayerGrid questions={questions} />
    </section>
  );
}
