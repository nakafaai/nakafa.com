"use client";

import {
  AiBrain02Icon,
  ArrowLeft02Icon,
  ArrowRight02Icon,
  Coins01Icon,
  InformationCircleIcon,
  Summation01Icon,
  TextAllCapsIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { useTranslations } from "next-intl";
import { memo, useState } from "react";
import { useMessage } from "@/components/ai/context/use-message";
import { aiModels } from "@/lib/data/models";

export const AiChatMessageCredits = memo(() => {
  const t = useTranslations("Ai");

  const credits = useMessage((state) => state.message.metadata?.credits);
  const tokens = useMessage((state) => state.message.metadata?.tokens);
  const modelId = useMessage((state) => state.message.metadata?.model);

  const [open, setOpen] = useState(false);

  // Only show for assistant messages with credits
  if (!credits || credits <= 0) {
    return null;
  }

  const model = aiModels.find((m) => m.value === modelId);
  const ModelIcon = model?.icon;

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild onMouseEnter={() => setOpen(true)}>
        <Button size="icon" variant="outline">
          <HugeIcons icon={InformationCircleIcon} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end">
        {/* Content */}
        <div className="space-y-3">
          {/* Model */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <HugeIcons className="size-4" icon={AiBrain02Icon} />
              <span className="text-muted-foreground">{t("model")}</span>
            </div>
            <p className="flex items-center gap-2">
              {ModelIcon && <ModelIcon />}
              {model?.label ?? modelId}
            </p>
          </div>

          {/* Credits */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <HugeIcons className="size-4" icon={Coins01Icon} />
              <span className="text-muted-foreground">
                {t("credits-label")}
              </span>
            </div>
            <span className="tabular-nums">
              {t("credits-count", { count: credits })}
            </span>
          </div>

          {/* Token Usage */}
          {tokens &&
            ((tokens.input ?? 0) > 0 ||
              (tokens.output ?? 0) > 0 ||
              (tokens.total ?? 0) > 0) && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <HugeIcons className="size-4" icon={TextAllCapsIcon} />
                  <div className="text-muted-foreground text-sm">
                    {t("token-usage")}
                  </div>
                </div>

                <div className="space-y-1">
                  {/* Input */}
                  {tokens?.input !== undefined && tokens.input > 0 && (
                    <div className="flex items-center justify-between rounded-sm bg-muted p-2 text-sm">
                      <div className="flex items-center gap-2">
                        <HugeIcons className="size-4" icon={ArrowLeft02Icon} />
                        <span>{t("input-tokens")}</span>
                      </div>
                      <span className="tabular-nums">
                        {tokens.input.toLocaleString()}
                      </span>
                    </div>
                  )}

                  {/* Output */}
                  {tokens?.output !== undefined && tokens.output > 0 && (
                    <div className="flex items-center justify-between rounded-sm bg-muted p-2 text-sm">
                      <div className="flex items-center gap-2">
                        <HugeIcons className="size-4" icon={ArrowRight02Icon} />
                        <span>{t("output-tokens")}</span>
                      </div>
                      <span className="tabular-nums">
                        {tokens.output.toLocaleString()}
                      </span>
                    </div>
                  )}

                  {/* Total */}
                  {tokens?.total !== undefined && tokens.total > 0 && (
                    <div className="flex items-center justify-between rounded-sm bg-secondary p-2 text-secondary-foreground text-sm">
                      <div className="flex items-center gap-2">
                        <HugeIcons className="size-4" icon={Summation01Icon} />
                        <span>{t("total-tokens")}</span>
                      </div>
                      <span className="tabular-nums">
                        {tokens.total.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
        </div>
      </PopoverContent>
    </Popover>
  );
});
AiChatMessageCredits.displayName = "AiChatMessageCredits";
