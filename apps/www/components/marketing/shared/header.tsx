import { Button } from "@repo/design-system/components/ui/button";
import { Link } from "@repo/internationalization/src/navigation";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { HeaderContainer } from "@/components/marketing/shared/header-container";
import { HeaderCta } from "@/components/marketing/shared/header-cta";

export function Header() {
  const t = useTranslations("Marketing");

  return (
    <HeaderContainer>
      <div className="mx-auto flex w-full items-center justify-between gap-2 px-6 lg:px-12">
        <Link className="flex items-center gap-2" href="/">
          <Image
            alt="Nakafa"
            className="size-8 rounded-full border"
            height={32}
            src="/logo.svg"
            width={32}
          />
          <span className="font-medium">Nakafa</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <Button variant="ghost">
            <Link href="/features">{t("features")}</Link>
          </Button>
          <Button variant="ghost">
            <Link href="/pricing">{t("pricing")}</Link>
          </Button>
        </nav>

        <HeaderCta />
      </div>
    </HeaderContainer>
  );
}
