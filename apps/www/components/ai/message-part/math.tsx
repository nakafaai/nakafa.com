"use client";

import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { useDisclosure } from "@mantine/hooks";
import type { DataPart } from "@repo/ai/schema/data";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/design-system/components/ui/collapsible";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cn } from "@repo/design-system/lib/utils";
import type { MathCopyKey } from "@repo/math/schema/copy";
import type { MathOperation } from "@repo/math/schema/operations";
import { useTranslations } from "next-intl";

import { translateMathCopy } from "@/components/ai/message-part/math/copy";
import { MathEvidence } from "@/components/ai/message-part/math/evidence";
import { getMathIcon } from "@/components/ai/message-part/math/icons";
import { MathPedagogy } from "@/components/ai/message-part/math/pedagogy";

interface Props {
  message: DataPart["math-reasoning"];
}

type CollapsibleMathReasoningPart = Exclude<
  DataPart["math-reasoning"],
  { readonly status: "error" }
>;

/** Renders one deterministic math evidence part in the chat transcript. */
export const MathPart = ({ message }: Props) => {
  const t = useTranslations("Ai");
  const [expanded, { set }] = useDisclosure(false);
  const translate = (key: MathCopyKey) => t(key);

  if (message.status === "error") {
    return <MathErrorRow text={translate("math-error")} />;
  }

  const title = translateMathCopy({
    key: titleKeyForMessage(message),
    t: (key, values) => t(key, values),
  });
  const operation =
    message.status === "done"
      ? message.result.work.plannedRequest.operation
      : "evaluate";

  return (
    <Collapsible
      className="not-prose flex max-w-full flex-col gap-2"
      onOpenChange={set}
      open={expanded}
    >
      <CollapsibleTrigger className="flex w-full cursor-pointer items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground">
        <HugeIcons
          className={cn("size-4 shrink-0")}
          icon={getMathIcon(operation)}
        />
        <span className="truncate">{title}</span>
        <HugeIcons
          className={cn(
            "size-4 shrink-0 transition-transform",
            expanded ? "rotate-180" : "rotate-0"
          )}
          icon={ArrowDown01Icon}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="max-w-full overflow-hidden text-muted-foreground text-sm outline-none">
        <div className="flex max-w-full flex-col gap-4">
          <MathEvidence message={message} />
          <MathPedagogy lane={message.pedagogy} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
MathPart.displayName = "MathPart";

/** Renders a compact learner-facing MathReasoning error without an artifact shell. */
function MathErrorRow({ text }: { readonly text: string }) {
  return <p className="not-prose text-muted-foreground text-sm">{text}</p>;
}

/** Selects the localized title key for a streamed MathWork data part. */
function titleKeyForMessage(
  message: CollapsibleMathReasoningPart
): MathCopyKey {
  if (message.status === "loading") {
    return "math-loading";
  }

  return titleKeyForOperation(message.result.work.plannedRequest.operation);
}

/** Converts one schema-owned operation id into its localized title key. */
function titleKeyForOperation(operation: MathOperation): MathCopyKey {
  return `math-${operation}`;
}
