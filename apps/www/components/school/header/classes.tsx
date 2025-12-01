import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@repo/design-system/components/ui/input-group";
import { PlusIcon, SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";

export function SchoolHeaderClasses() {
  const t = useTranslations("School.Classes");
  return (
    <header className="flex h-16 w-full items-center justify-between gap-3 border-b px-6">
      <InputGroup>
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput placeholder={t("search-placeholder")} />
      </InputGroup>
      <ButtonGroup>
        <Button>
          <PlusIcon />
          <span className="hidden sm:inline">{t("create-class")}</span>
        </Button>
      </ButtonGroup>
    </header>
  );
}
