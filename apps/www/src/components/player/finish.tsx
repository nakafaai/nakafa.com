"use client";

import { StopIcon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { usePlayer } from "@/components/player/provider";

/**
 * The one primary action: a button that asks for confirmation before it
 * finishes the questions. Picking a number in the confirmation closes it and
 * goes to that question, once the dialog has finished closing. Confirming
 * keeps the dialog and the button as they are until the page changes.
 */
export function PlayerFinish({
  children,
  description,
  label,
  locked,
  onFinish,
  onIntent,
  pending,
  title,
}: {
  /** What the confirmation shows under its description. */
  children?: ReactNode;
  description: string;
  /** The text of the button and of the confirmation. */
  label: string;
  /** Finishing is closed because time ran out. */
  locked: boolean;
  onFinish: () => void;
  /** Warms what follows a finish, when the learner shows intent to finish. */
  onIntent: () => void;
  /** The finish is on its way to the server. */
  pending: boolean;
  title: string;
}) {
  const tCommon = useTranslations("Common");
  const overlay = usePlayer((state) => state.overlay);
  const waiting = usePlayer((state) => state.pending !== null);
  const open = usePlayer((state) => state.open);
  const close = usePlayer((state) => state.close);
  const settle = usePlayer((state) => state.settle);

  return (
    <>
      {/* Time running out closes the finish; a finish on its way only holds it still. */}
      <Button
        disabled={locked}
        inert={pending}
        onClick={() => {
          onIntent();
          open("finish");
        }}
        onFocus={onIntent}
        onPointerEnter={onIntent}
        onTouchStart={onIntent}
        type="button"
        variant="destructive"
      >
        <HugeIcons icon={StopIcon} />
        {label}
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
        {children}
      </ResponsiveDialog>
    </>
  );
}
