"use client";

import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { isModelId, type ModelId } from "@repo/ai/config/model";
import { HugeIcons } from "@repo/design-system/components/icons/huge-icons";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Menu,
  MenuGroup,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from "@repo/design-system/components/ui/menu";
import {
  usePathname,
  useRouter,
} from "@repo/internationalization/src/navigation";
import { useTranslations } from "next-intl";
import { useAi } from "@/components/ai/context/use-ai";
import { useUser } from "@/lib/context/use-user";
import { aiModels, getAiModel } from "@/lib/data/models";

/**
 * Renders the COSS menu for choosing the active Nina model.
 *
 * The menu keeps Base UI radio semantics and COSS Menu row chrome. The caller
 * only supplies the model icon/title/subtitle layout inside each native row.
 */
export function AiChatModel() {
  const t = useTranslations("Ai");
  const pathname = usePathname();
  const router = useRouter();
  const user = useUser((state) => state.user);

  const model = useAi((state) => state.model);
  const setModel = useAi((state) => state.setModel);
  const setOpen = useAi((state) => state.setOpen);

  const selectedModel = getAiModel(model);

  const handleModelChange = (value: ModelId) => {
    if (!user) {
      setOpen(false);
      router.push(`/auth?redirect=${pathname}`);
      return;
    }

    setModel(value);
  };

  const handleValueChange = (value: string) => {
    if (!isModelId(value)) {
      return;
    }

    handleModelChange(value);
  };

  return (
    <Menu>
      <MenuTrigger
        render={
          <Button variant="ghost">
            <HugeIcons className="size-4" icon={selectedModel.icon} />
            {selectedModel.label}
            <HugeIcons className="size-4" icon={ArrowDown01Icon} />
          </Button>
        }
      />
      <MenuPopup align="start" className="w-56">
        <MenuGroup>
          <MenuRadioGroup onValueChange={handleValueChange} value={model}>
            {aiModels.map((item) => (
              <MenuRadioItem key={item.value} value={item.value}>
                <span className="flex min-w-0 items-center gap-2">
                  <HugeIcons
                    className="size-4 text-muted-foreground"
                    icon={item.icon}
                  />
                  <span className="grid min-w-0 gap-0.5 leading-tight">
                    <span>{item.label}</span>
                    <span className="text-muted-foreground text-xs">
                      {t(item.subtitleKey)}
                    </span>
                  </span>
                </span>
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </MenuGroup>
      </MenuPopup>
    </Menu>
  );
}
