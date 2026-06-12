"use client";

import {
  ArrowDown01Icon,
  Copy01Icon,
  LinkSquare02Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { useClipboard } from "@mantine/hooks";
import { HugeIcons } from "@repo/design-system/components/icons/huge-icons";
import {
  BrandLogo,
  type BrandLogoName,
} from "@repo/design-system/components/logos/brand";
import { Button } from "@repo/design-system/components/ui/button";
import { Group, GroupSeparator } from "@repo/design-system/components/ui/group";
import {
  Menu,
  MenuGroup,
  MenuLinkItem,
  MenuPopup,
  MenuTrigger,
} from "@repo/design-system/components/ui/menu";
import { toastManager } from "@repo/design-system/components/ui/toast";
import { Link } from "@repo/internationalization/src/navigation";
import { useTranslations } from "next-intl";
import { getGithubUrl } from "@/lib/utils/github";

/**
 * Renders open/share actions for one content page.
 */
export function OpenContent({
  slug,
  content,
}: {
  slug: string;
  content?: string;
}) {
  const t = useTranslations("Common");
  const clipboard = useClipboard({ timeout: 500 });

  const handleCopy = () => {
    if (!content) {
      toastManager.add({ type: "error", title: t("copy-error") });
      return;
    }
    clipboard.copy(content);
    toastManager.add({ type: "success", title: t("copy-success") });
  };

  const locale = slug.split("/")[1];
  const path = `/${slug.split("/").slice(2).join("/")}`;
  const markdownUrl = new URL(`${slug}.mdx`, "https://nakafa.com");
  const q = `I'm looking at this ${markdownUrl}, help me understand.`;

  const githubUrl = getGithubUrl({
    path: `/packages/contents${path}/${locale}.mdx`,
  });

  const links = [
    {
      title: t("open-in-github"),
      href: githubUrl,
      logo: "github",
    },
    {
      title: t("open-in-chatgpt"),
      href: `https://chatgpt.com/?${new URLSearchParams({ hints: "search", q })}`,
      logo: "openai",
    },
    {
      title: t("open-in-gemini"),
      href: `https://gemini.google.com/app?${new URLSearchParams({ q })}`,
      logo: "gemini",
    },
    {
      title: t("open-in-claude"),
      href: `https://claude.ai/new?${new URLSearchParams({ q })}`,
      logo: "claude",
    },
  ] as const satisfies readonly {
    href: string;
    logo: BrandLogoName;
    title: string;
  }[];

  return (
    <Group>
      <Button disabled={!content} onClick={handleCopy} variant="secondary">
        <HugeIcons icon={clipboard.copied ? Tick01Icon : Copy01Icon} />
        {t("copy-content")}
      </Button>

      <GroupSeparator />

      <Menu>
        <MenuTrigger
          render={
            <Button aria-label={t("open")} size="icon" variant="secondary">
              <span className="sr-only">{t("open")}</span>
              <HugeIcons icon={ArrowDown01Icon} />
            </Button>
          }
        />

        <MenuPopup className="w-56">
          <MenuGroup>
            {links.map((item) => (
              <MenuLinkItem
                key={item.title}
                render={
                  <Link
                    href={item.href}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <BrandLogo name={item.logo} />
                    {item.title}
                    <HugeIcons className="ms-auto" icon={LinkSquare02Icon} />
                  </Link>
                }
              />
            ))}
          </MenuGroup>
        </MenuPopup>
      </Menu>
    </Group>
  );
}
