"use client";

import { Rocket01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useTranslations } from "next-intl";
import { useTryoutStart } from "@/components/tryout/start-state";

export function TryoutStartDialog() {
  const tTryouts = useTranslations("Tryouts");
  const isActionPending = useTryoutStart((state) => state.meta.isActionPending);
  const isDialogOpen = useTryoutStart((state) => state.meta.isDialogOpen);
  const confirmStart = useTryoutStart((state) => state.actions.confirmStart);
  const setDialogOpen = useTryoutStart((state) => state.actions.setDialogOpen);

  return (
    <ResponsiveDialog
      description={tTryouts("start-dialog-description")}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            onClick={() => setDialogOpen(false)}
            type="button"
            variant="outline"
          >
            {tTryouts("cancel-cta")}
          </Button>
          <Button
            disabled={isActionPending}
            onClick={confirmStart}
            type="button"
          >
            <Spinner icon={Rocket01Icon} isLoading={isActionPending} />
            {tTryouts("start-cta")}
          </Button>
        </div>
      }
      open={isDialogOpen}
      setOpen={setDialogOpen}
      title={tTryouts("start-dialog-title")}
    />
  );
}
