"use client";

import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  ArrowUpRight01Icon,
  Task01Icon,
} from "@hugeicons/core-free-icons";
import { useDisclosure } from "@mantine/hooks";
import type { NakafaDataPart } from "@repo/ai/schema/data";
import { HugeIcons } from "@repo/design-system/components/icons/huge-icons";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { useTranslations } from "next-intl";

const MAX_SHOWN_EXERCISES = 5;

interface Props {
  message: Extract<NakafaDataPart, { kind: "exercise"; status: "done" }>;
}

/** Renders a compact exercise-set or exercise-question preview. */
export const ExercisePart = ({ message }: Props) => {
  const t = useTranslations("Ai");
  const [expanded, { toggle }] = useDisclosure(false);
  const numbers = expanded
    ? message.result.numbers
    : message.result.numbers.slice(0, MAX_SHOWN_EXERCISES);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <HugeIcons className="size-4 text-muted-foreground" icon={Task01Icon} />
        <span className="text-muted-foreground text-sm">
          {t("nakafa-exercise")}
        </span>
        <Badge variant="outline">{message.result.count}</Badge>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {numbers.map((number) => (
          <Button
            key={number}
            render={
              <a
                href={`${message.result.url}/${number}`}
                rel="noopener noreferrer"
                target="_blank"
              >
                {t("question-number", { number })}
                <HugeIcons icon={ArrowUpRight01Icon} />
              </a>
            }
            size="sm"
            variant="outline"
          />
        ))}
        {message.result.numbers.length > MAX_SHOWN_EXERCISES ? (
          <Button onClick={toggle} size="sm" variant="outline">
            {expanded ? t("show-less") : t("show-more")}
            <HugeIcons icon={expanded ? ArrowUp01Icon : ArrowDown01Icon} />
          </Button>
        ) : null}
      </div>
    </div>
  );
};
ExercisePart.displayName = "ExercisePart";
