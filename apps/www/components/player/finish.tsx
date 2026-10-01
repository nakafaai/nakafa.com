"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { useTranslations } from "next-intl";
import { usePlayer, usePlayerView } from "@/components/player/context";
import { PlayerCounts } from "@/components/player/navigator/counts";
import { PlayerGrid } from "@/components/player/navigator/grid";

/**
 * The one primary action. Its confirmation reviews flagged and unanswered
 * questions; picking one closes the dialog and jumps there. Confirming keeps
 * the dialog and button unchanged until the destination renders.
 */
export function PlayerFinish({
  description,
  title,
}: {
  readonly description: string;
  readonly title: string;
}) {
  const t = useTranslations("Player");
  const finish = usePlayer((session) => session.actions.finish);
  const prepareFinish = usePlayer((session) => session.actions.prepareFinish);
  const close = usePlayerView((view) => view.close);
  const open = usePlayerView((view) => view.open);
  const overlay = usePlayerView((view) => view.overlay);
  const pending = usePlayerView((view) => view.pending);
  const settle = usePlayerView((view) => view.settle);

  return (
    <>
      <Button
        onClick={() => {
          prepareFinish();
          open("finish");
        }}
        onFocus={prepareFinish}
        onPointerEnter={prepareFinish}
        type="button"
      >
        {t("finish")}
      </Button>
      <ResponsiveDialog
        description={description}
        finalFocus={pending === null}
        footer={
          <>
            <Button onClick={close} type="button" variant="outline">
              {t("cancel")}
            </Button>
            <Button onClick={finish} type="button">
              {t("finish")}
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
        <PlayerReview />
      </ResponsiveDialog>
    </>
  );
}

/** Totals plus the flagged and unanswered numbers worth a second look. */
function PlayerReview() {
  const t = useTranslations("Player");
  const questions = usePlayer((session) => session.state.questions);
  const flagged = questions.filter((question) => question.flagged);
  const unanswered = questions.filter((question) => !question.answered);
  return (
    <div className="grid gap-6">
      <PlayerCounts />
      {flagged.length > 0 ? (
        <section className="grid gap-3">
          <h3 className="font-medium text-sm">{t("flagged")}</h3>
          <PlayerGrid questions={flagged} />
        </section>
      ) : null}
      {unanswered.length > 0 ? (
        <section className="grid gap-3">
          <h3 className="font-medium text-sm">{t("unanswered")}</h3>
          <PlayerGrid questions={unanswered} />
        </section>
      ) : null}
    </div>
  );
}
