"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { Label } from "@repo/design-system/components/ui/label";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Switch } from "@repo/design-system/components/ui/switch";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  CardSection,
  CardSectionFooter,
} from "@/components/shared/card/section";
import { useMemoryActions } from "@/components/user/settings/memory/actions.client";
import { useMemory } from "@/components/user/settings/memory/provider";

const PAUSE_ID = "user-settings-memory-pause";

/**
 * Introduces Memory: what it is, the switch that pauses it, and the action
 * that deletes everything Nina remembers. Pausing keeps every memory.
 */
export function MemoryHeader() {
  const t = useTranslations("Memory");
  const auth = useTranslations("Auth");
  const common = useTranslations("Common");
  const { empty, paused } = useMemory((list) => ({
    empty: list.memories.length === 0,
    paused: list.paused,
  }));
  const { clear, pause } = useMemoryActions();
  const [confirming, setConfirming] = useState(false);

  return (
    <CardSection>
      <CardHeader>
        <CardTitle>{auth("memory")}</CardTitle>
        <CardDescription>{auth("memory-description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor={PAUSE_ID}>{t("pause")}</Label>
            <p className="text-muted-foreground text-sm">
              {t("pause-description")}
            </p>
          </div>
          <Switch
            aria-label={t("pause")}
            checked={paused}
            id={PAUSE_ID}
            onCheckedChange={pause}
          />
        </div>
      </CardContent>
      <CardSectionFooter>
        <div className="flex w-full items-center justify-between gap-4">
          <p className="text-muted-foreground text-sm">{t("footer")}</p>
          <Button
            disabled={empty}
            onClick={() => setConfirming(true)}
            size="sm"
            variant="destructive-outline"
          >
            {t("clear")}
          </Button>
        </div>
      </CardSectionFooter>
      <ResponsiveDialog
        description={t("clear-description")}
        footer={
          <>
            <Button
              onClick={() => setConfirming(false)}
              type="button"
              variant="outline"
            >
              {common("cancel")}
            </Button>
            <Button
              onClick={() => {
                setConfirming(false);
                clear();
              }}
              type="button"
              variant="destructive"
            >
              {t("clear-confirm")}
            </Button>
          </>
        }
        open={confirming}
        setOpen={setConfirming}
        title={t("clear-title")}
      />
    </CardSection>
  );
}
