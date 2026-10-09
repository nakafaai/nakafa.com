"use client";

import { LinkSquare02Icon } from "@hugeicons/core-free-icons";
import { BrandLogo } from "@repo/design-system/components/logos/brand";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSubContent,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Link } from "@repo/internationalization/src/navigation";
import { COMPANY_IDENTITY } from "@repo/seo/company";
import { Array as Arr } from "effect";
import { useTranslations } from "next-intl";

/**
 * Lists where a reader can open one content page: its source and three
 * assistants.
 *
 * The brand logos are one module of about 49 kB, so the content actions load
 * this submenu when their menu opens instead of with the page.
 */
export function OpenInSubmenuContent({
  slug,
  sourceUrl,
}: {
  slug: string;
  sourceUrl: null | string | undefined;
}) {
  const t = useTranslations("Common");
  const markdownUrl = new URL(`${slug}.mdx`, COMPANY_IDENTITY.url);
  const q = `I'm looking at this ${markdownUrl}, help me understand.`;

  const sourceLinks = sourceUrl
    ? ([
        { href: sourceUrl, logo: "github", title: t("open-in-github") },
      ] as const)
    : [];
  const assistantLinks = [
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
  ] as const;
  const links = Arr.appendAll(sourceLinks, assistantLinks);

  return (
    <DropdownMenuSubContent className="w-56">
      <DropdownMenuGroup>
        {Arr.map(links, (item) => (
          <DropdownMenuItem
            key={item.title}
            render={
              <Link href={item.href} rel="noopener noreferrer" target="_blank">
                <BrandLogo name={item.logo} />
                {item.title}
                <HugeIcons className="ms-auto" icon={LinkSquare02Icon} />
              </Link>
            }
          />
        ))}
      </DropdownMenuGroup>
    </DropdownMenuSubContent>
  );
}
