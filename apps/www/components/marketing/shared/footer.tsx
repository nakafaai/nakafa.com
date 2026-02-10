import {
  DiscordIcon,
  GithubIcon,
  InstagramIcon,
  Linkedin02Icon,
  YoutubeIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { useTranslations } from "next-intl";
import { FooterAction } from "@/components/marketing/shared/footer-action";
import { FooterArt } from "@/components/marketing/shared/footer-art";
import { articlesMenu } from "@/components/sidebar/_data/articles";
import { holyMenu } from "@/components/sidebar/_data/holy";
import { subjectMenu } from "@/components/sidebar/_data/subject";

const highSchoolSubjects =
  subjectMenu.find((subject) => subject.title === "high-school")?.items || [];
const universitySubjects =
  subjectMenu.find((subject) => subject.title === "university")?.items || [];

export function Footer() {
  const t = useTranslations("About");
  const tLegal = useTranslations("Legal");
  const tSubject = useTranslations("Subject");
  const tHoly = useTranslations("Holy");
  const tCommon = useTranslations("Common");
  const tArticles = useTranslations("Articles");

  return (
    <footer className="w-full border-t" id="footer">
      <div className="mx-auto w-full max-w-7xl px-6">
        <div className="grid scroll-mt-28 pt-24">
          <section className="flex flex-col justify-between gap-8 md:flex-row">
            <div className="flex flex-col gap-3">
              <span className="font-medium text-muted-foreground text-sm">
                {tCommon("subject")}
              </span>
              <ul className="flex flex-col gap-2">
                {highSchoolSubjects.map((subject) => (
                  <li key={subject.value}>
                    <LinkItem
                      href={subject.href}
                      label={tSubject(subject.title, { grade: subject.value })}
                    />
                  </li>
                ))}

                {universitySubjects.map((subject) => (
                  <li key={subject.title}>
                    <LinkItem
                      href={subject.href}
                      label={tSubject(subject.title)}
                    />
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <span className="font-medium text-muted-foreground text-sm">
                {tHoly("holy")}
              </span>
              <ul className="flex flex-col gap-2">
                {holyMenu.map((holy) => (
                  <li key={holy.title}>
                    <LinkItem href={holy.href} label={tHoly(holy.title)} />
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <span className="font-medium text-muted-foreground text-sm">
                {tCommon("articles")}
              </span>
              <ul className="flex flex-col gap-2">
                {articlesMenu.map((article) => (
                  <li key={article.title}>
                    <LinkItem
                      href={article.href}
                      label={tArticles(article.title)}
                    />
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <span className="font-medium text-muted-foreground text-sm">
                {t("company")}
              </span>
              <ul className="flex flex-col gap-2">
                <li>
                  <LinkItem href="/about" label={t("about-us")} />
                </li>
                <li>
                  <LinkItem href="/events" label={t("events")} />
                </li>
                <li>
                  <LinkItem
                    href="https://discord.gg/CPCSfKhvfQ"
                    label={t("community")}
                  />
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <span className="font-medium text-muted-foreground text-sm">
                {tLegal("terms-and-policies")}
              </span>
              <ul className="flex flex-col gap-2">
                <li>
                  <LinkItem
                    href="/terms-of-service"
                    label={tLegal("terms-of-service")}
                  />
                </li>
                <li>
                  <LinkItem
                    href="/privacy-policy"
                    label={tLegal("privacy-policy")}
                  />
                </li>
                <li>
                  <LinkItem
                    href="/security-policy"
                    label={tLegal("security-policy")}
                  />
                </li>
              </ul>
            </div>
          </section>
        </div>
      </div>

      <NavigationLink
        className="mx-auto flex w-full max-w-7xl px-6 py-16 transition-colors ease-out hover:text-primary"
        href="/"
        rel="noopener noreferrer"
        target="_blank"
      >
        <span className="mx-auto font-bold text-7xl transition-colors duration-300 ease-out hover:text-primary sm:text-8xl md:text-9xl lg:text-[12rem] xl:text-[18rem]">
          Nakafa
        </span>
      </NavigationLink>

      <section className="w-full border-t">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-4 px-6 py-6 lg:flex-row">
          <p className="text-center text-sm">
            {tCommon("copyright", { year: "2025" })}
          </p>
          <div className="flex flex-col items-center gap-4 lg:flex-row">
            <div className="flex items-center gap-1">
              {socialMedia.map((social) => (
                <Button
                  key={social.label}
                  nativeButton={false}
                  render={
                    <a
                      aria-label={social.label}
                      href={social.href}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      <HugeIcons className="size-4" icon={social.icon} />
                      <span className="sr-only">{social.label}</span>
                    </a>
                  }
                  size="icon"
                  variant="ghost"
                />
              ))}
            </div>
            <FooterAction />
          </div>
        </div>
      </section>

      <FooterArt />
    </footer>
  );
}

function LinkItem({ href, label }: { href: string; label: string }) {
  return (
    <NavigationLink
      className="text-sm transition-colors ease-out hover:text-primary"
      href={href}
    >
      {label}
    </NavigationLink>
  );
}

const socialMedia = [
  {
    href: "https://www.youtube.com/@nakafaa",
    icon: YoutubeIcon,
    label: "YouTube",
  },
  {
    href: "https://discord.gg/CPCSfKhvfQ",
    icon: DiscordIcon,
    label: "Discord",
  },
  {
    href: "https://github.com/nakafaai",
    icon: GithubIcon,
    label: "GitHub",
  },
  {
    href: "https://www.linkedin.com/company/nakafa",
    icon: Linkedin02Icon,
    label: "LinkedIn",
  },
  {
    href: "https://www.instagram.com/nakafa.ai/",
    icon: InstagramIcon,
    label: "Instagram",
  },
];
