"use client";

import {
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
import { Array as Arr, Option } from "effect";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useMessage } from "@/components/ai/message/context";
import { getAiModel } from "@/lib/data/models";

/** Sums one token count across a turn's usage records; a missing turn sums to zero. */
function sumTurnUsage(
  turn:
    | {
        readonly usage: readonly {
          readonly input: number;
          readonly output: number;
        }[];
      }
    | null
    | undefined,
  field: "input" | "output"
) {
  return Option.getOrElse(
    Option.map(Option.fromNullishOr(turn), (current) =>
      Arr.reduce(current.usage, 0, (sum, usage) => sum + usage[field])
    ),
    () => 0
  );
}

export function AiChatMessageCredits() {
  const t = useTranslations("Ai");

  const turn = useMessage((state) => state.turn);
  const role = useMessage((state) => state.message.role);
  const credits =
    role === "assistant" && turn?.state.status === "complete"
      ? (turn.credits ?? 0)
      : 0;
  const modelId = turn?.modelId;
  const input = turn?.tokens?.input ?? sumTurnUsage(turn, "input");
  const output = turn?.tokens?.output ?? sumTurnUsage(turn, "output");
  const tokens = {
    input,
    output,
    total: turn?.tokens?.total ?? input + output,
  };

  const [open, setOpen] = useState(false);

  // Only show for assistant messages with credits
  if (credits <= 0) {
    return null;
  }

  if (!modelId) {
    return null;
  }

  const model = getAiModel(modelId);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        onMouseEnter={() => setOpen(true)}
        render={<Button size="icon" variant="outline" />}
      >
        <HugeIcons icon={InformationCircleIcon} />
      </PopoverTrigger>
      <PopoverContent align="end">
        {/* Content */}
        <div className="space-y-3">
          {/* Model */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <HugeIcons className="size-4" icon={model.icon} />
              <span className="text-muted-foreground">{t("model")}</span>
            </div>
            <p className="flex items-center gap-2">{model.label}</p>
          </div>

          {/* Credits */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <HugeIcons className="size-4" icon={Coins01Icon} />
              <span className="text-muted-foreground">
                {t("credits-label")}
              </span>
            </div>
            <span className="tabular-nums">{credits.toLocaleString()}</span>
          </div>

          {/* Token Usage */}
          {tokens.total > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <HugeIcons className="size-4" icon={TextAllCapsIcon} />
                <div className="text-muted-foreground text-sm">
                  {t("token-usage")}
                </div>
              </div>

              <div className="space-y-1">
                {/* Input */}
                {tokens.input > 0 && (
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
                {tokens.output > 0 && (
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
                {tokens.total > 0 && (
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
}
AiChatMessageCredits.displayName = "AiChatMessageCredits";
