import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { HeaderContainer } from "@/components/sidebar/header-container";

export function Header() {
  return (
    <HeaderContainer>
      <div className="flex w-full items-center justify-between gap-2 px-6">
        <ButtonGroup />
      </div>
    </HeaderContainer>
  );
}
