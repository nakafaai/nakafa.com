"use client";

import type { Locale } from "@repo/internationalization/src/locale";
import { Option } from "effect";
import type { ComponentProps } from "react";
import { getTryoutPageTarget } from "@/components/tryout/route/path";
import type { LinkPreload } from "@/lib/routing/link";
import { Link } from "@/lib/routing/link";

/**
 * A link to one try-out page, which carries the attempt of the page when one is
 * open, and pins the target's locale when the path belongs to another locale
 * than the page on screen. An address that names no try-out page renders
 * nothing, so a row never links to a route that does not exist.
 */
export function TryoutPageLink({
  attemptId,
  locale,
  preload,
  publicPath,
  ...anchor
}: Omit<ComponentProps<"a">, "href" | "target"> & {
  readonly attemptId?: string | undefined;
  readonly locale?: Locale | undefined;
  readonly preload?: LinkPreload | undefined;
  readonly publicPath: string;
}) {
  return Option.match(getTryoutPageTarget({ attemptId, locale, publicPath }), {
    onNone: () => null,
    onSome: (target) => (
      <Link
        {...anchor}
        {...(preload === undefined ? {} : { preload })}
        {...target}
      />
    ),
  });
}
