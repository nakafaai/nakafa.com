"use client";

import { StopIcon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { useTranslations } from "next-intl";
import { useState } from "react";

/**
 * The student's one primary action. It asks before the answers close, because a finished attempt
 * takes no answer again. The action stays closed while a proctor holds the sitting. On a phone it shows
 * its icon alone, named for assistive technology, so the header stays one row.
 */
export function SittingFinish({
  locked,
  onFinish,
}: {
  readonly locked: boolean;
  readonly onFinish: () => void;
}) {
  const t = useTranslations("Exams");
  const tCommon = useTranslations("Common");
  const tTryouts = useTranslations("Tryouts");
  const [open, setOpen] = useState(false);
  const label = tTryouts("complete-part-cta");

  return (
    <>
      <Button
        disabled={locked}
        onClick={() => setOpen(true)}
        type="button"
        variant="destructive"
      >
        <HugeIcons icon={StopIcon} />
        <span className="max-sm:sr-only">{label}</span>
      </Button>
      <ResponsiveDialog
        description={t("finish-description")}
        footer={
          <>
            <Button
              onClick={() => setOpen(false)}
              type="button"
              variant="outline"
            >
              {tCommon("cancel")}
            </Button>
            <Button
              onClick={() => {
                setOpen(false);
                onFinish();
              }}
              type="button"
              variant="destructive"
            >
              <HugeIcons icon={StopIcon} />
              {label}
            </Button>
          </>
        }
        open={open}
        setOpen={setOpen}
        title={t("finish-title")}
      />
    </>
  );
}
