import { SiDiscord } from "@icons-pack/react-simple-icons";
import { Avatar } from "@repo/design-system/components/contributor/avatar";
import { Button } from "@repo/design-system/components/ui/button";
import { HeartHandshakeIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { contributors } from "@/lib/data/contributor";

export function Community() {
  const t = useTranslations("About");

  return (
    <section className="grid scroll-mt-28 gap-12" id="community">
      <div className="grid justify-center gap-6 text-center">
        <h2 className="font-semibold text-3xl tracking-tight sm:text-4xl">
          {t("join-our-community")}
        </h2>
        <p className="max-w-2xl text-balance text-lg text-muted-foreground md:text-xl">
          {t("join-our-community-description")}
        </p>

        <div className="flex w-full items-center justify-center gap-4">
          <Button asChild variant="secondary">
            <Link href="https://github.com/nakafaai/nakafa.com" target="_blank">
              <HeartHandshakeIcon />
              {t("contribute")}
            </Link>
          </Button>
          <Button asChild>
            <Link href="https://discord.gg/CPCSfKhvfQ" target="_blank">
              <SiDiscord />
              {t("join-community")}
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {contributors.map((contributor) => (
          <Avatar
            contributor={contributor}
            key={contributor.username}
            size="lg"
          />
        ))}
      </div>
    </section>
  );
}
