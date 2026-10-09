"use client";

import { LinkSquare02Icon } from "@hugeicons/core-free-icons";
import {
  BrandLogo,
  brandLogoNames,
} from "@repo/design-system/components/logos/brand";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSubContent,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Link } from "@repo/internationalization/src/navigation";
import { Array as Arr, Schema } from "effect";
import { useTranslations } from "next-intl";

/** One link that a content page offers its reader, with a brand logo of its own. */
const SourceLinkSchema = Schema.Struct({
  href: Schema.String,
  logo: Schema.Literals(brandLogoNames),
  title: Schema.String,
});

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
  const markdownUrl = new URL(`${slug}.mdx`, "https://nakafa.com");
  const q = `I'm looking at this ${markdownUrl}, help me understand.`;

  const sourceLinks: (typeof SourceLinkSchema.Type)[] = sourceUrl
    ? [{ href: sourceUrl, logo: "github", title: t("open-in-github") }]
    : [];
  const assistantLinks: (typeof sourceLinks)[number][] = [
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
  ];
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
