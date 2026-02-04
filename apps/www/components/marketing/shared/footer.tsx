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
    <footer className="mx-auto w-full max-w-7xl p-6" id="footer">
      <div className="grid scroll-mt-28 rounded-xl border shadow-sm">
        <div className="grid">
          <section className="flex flex-col justify-between gap-6 p-6 md:flex-row">
            <div className="flex flex-col gap-2">
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

            <div className="flex flex-col gap-2">
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

            <div className="flex flex-col gap-2">
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

            <div className="flex flex-col gap-2">
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

            <div className="flex flex-col gap-2">
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

          <section className="mx-2 mb-2 rounded-md border bg-muted/20 py-4 md:p-2">
            <div className="flex flex-col items-center justify-between gap-2 md:flex-row">
              <div className="flex flex-wrap items-center">
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

              <p className="text-balance px-2 text-center text-sm">
                {tCommon("copyright", { year: "2025" })}
              </p>
            </div>
          </section>
        </div>
      </div>
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
