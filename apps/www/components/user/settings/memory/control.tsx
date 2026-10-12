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

const REMEMBER_ID = "user-settings-memory-remember";

/**
 * The card that turns memory on and off and deletes all of it. Turning it off
 * keeps every memory. Deleting asks first, and names no memory: the page holds
 * only the memories it has loaded, which is a part of them once there are more
 * than a page.
 */
export function MemoryControl() {
  const t = useTranslations("Memory");
  const auth = useTranslations("Auth");
  const common = useTranslations("Common");
  const { empty, paused } = useMemory((reading) => ({
    empty: reading.empty,
    paused: reading.paused,
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
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor={REMEMBER_ID}>{t("remember")}</Label>
          <Switch
            checked={!paused}
            id={REMEMBER_ID}
            onCheckedChange={(remembers) => pause(!remembers)}
          />
        </div>
      </CardContent>
      <CardSectionFooter className="flex-wrap justify-between gap-4">
        <p className="text-muted-foreground text-sm">{t("footer")}</p>
        <Button
          disabled={empty}
          onClick={() => setConfirming(true)}
          size="sm"
          variant="destructive"
        >
          {t("clear")}
        </Button>
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
              {t("clear")}
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
