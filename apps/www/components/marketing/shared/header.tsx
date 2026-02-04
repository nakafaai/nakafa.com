import { Login01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { HeaderContainer } from "@/components/marketing/shared/header-container";

export function Header() {
  return (
    <HeaderContainer>
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-2 px-6">
        <div />
        <ButtonGroup>
          <Button>
            <HugeIcons icon={Login01Icon} />
            Sign in
          </Button>
        </ButtonGroup>
      </div>
    </HeaderContainer>
  );
}
