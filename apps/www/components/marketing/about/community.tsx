import { DiscordIcon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/icons/huge-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/contributor/avatar";
import { contributors } from "@/lib/data/contributor";

export function Community() {
  const t = useTranslations("About");

  return (
    <section className="scroll-mt-28" id="community">
      <div className="mx-auto w-full max-w-7xl border-x">
        <div className="grid gap-12 px-6 py-48">
          <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
            <div className="grid content-start gap-6">
              <h2 className="max-w-xl text-balance font-medium text-3xl tracking-tight sm:text-4xl">
                {t("community-title")}
              </h2>
              <div className="flex items-center gap-4">
                <Button
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
            <p className="max-w-xl text-pretty text-lg text-muted-foreground">
              {t("community-description")}
            </p>
          </div>

          <div className="flex flex-wrap gap-4">
            {contributors.map((contributor) => (
              <Avatar
                contributor={contributor}
                key={contributor.username}
                size="lg"
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
