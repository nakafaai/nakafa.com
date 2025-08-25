"use client";

import {
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectValue,
} from "@repo/design-system/components/ai/input";
import {
  SelectGroup,
  SelectLabel,
} from "@repo/design-system/components/ui/select";
import { useTranslations } from "next-intl";
import { useAi } from "@/lib/context/use-ai";
import { models } from "@/lib/data/models";

export function AiChatModel() {
  const t = useTranslations("Ai");

  const model = useAi((state) => state.model);
  const setModel = useAi((state) => state.setModel);

  const Icon = models.find((m) => m.value === model)?.icon;

  return (
    <PromptInputModelSelect
      onValueChange={(value: "standard" | "pro") => {
        setModel(value);
      }}
      value={model}
    >
      <PromptInputModelSelectTrigger>
        <PromptInputModelSelectValue>
          {Icon && <Icon />}
          {t(model)}
        </PromptInputModelSelectValue>
      </PromptInputModelSelectTrigger>
      <PromptInputModelSelectContent>
        <SelectGroup>
          <SelectLabel>{t("model")}</SelectLabel>
          {models.map((m) => (
            <PromptInputModelSelectItem key={m.value} value={m.value}>
              <m.icon />
              {t(m.value)}
            </PromptInputModelSelectItem>
          ))}
        </SelectGroup>
      </PromptInputModelSelectContent>
    </PromptInputModelSelect>
  );
}
