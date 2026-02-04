import { DiscordIcon, LoveKoreanFingerIcon } from "@hugeicons/core-free-icons";
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
        <div className="grid justify-center gap-6 text-center">
          <h2 className="font-semibold text-3xl tracking-tight sm:text-4xl">
            {t("join-our-community")}
          </h2>
          <p className="max-w-2xl text-balance text-lg text-muted-foreground md:text-xl">
            {t("join-our-community-description")}
          </p>

          <div className="flex w-full items-center justify-center gap-4">
            <Button
              nativeButton={false}
              render={
                <a
                  href="https://github.com/nakafaai/nakafa.com"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <HugeIcons icon={LoveKoreanFingerIcon} />
                  {t("contribute")}
                </a>
              }
              variant="secondary"
            />
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
