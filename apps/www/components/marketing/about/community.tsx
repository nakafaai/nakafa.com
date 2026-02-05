import { DiscordIcon } from "@hugeicons/core-free-icons";
import { Avatar } from "@repo/design-system/components/contributor/avatar";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "next-intl";
import { contributors } from "@/lib/data/contributor";

export function Community() {
  const t = useTranslations("About");

  return (
    <section className="scroll-mt-28 py-24" id="community">
      <div className="mx-auto grid w-full max-w-7xl gap-12 px-6">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          <div className="grid content-start gap-6">
            <h2 className="max-w-xl text-balance font-medium text-3xl tracking-tight sm:text-4xl">
              {t("community-title")}
            </h2>
            <div className="flex items-center gap-4">
              <Button
                nativeButton={false}
                render={
                  <a
                    href="https://discord.gg/CPCSfKhvfQ"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <HugeIcons icon={DiscordIcon} />
                    {t("join-community")}
                  </a>
                }
              />
            </div>
          </div>
          <p className="max-w-xl text-pretty text-lg text-muted-foreground lg:pt-2">
            {t("community-description")}
          </p>
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
      </div>
    </section>
  );
}
