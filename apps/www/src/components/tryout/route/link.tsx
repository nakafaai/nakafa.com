"use client";

import { Option } from "effect";
import type { ComponentProps } from "react";
import { getTryoutPageTarget } from "@/components/tryout/route/path";
import { Link, type LinkPreload } from "@/lib/routing/link";

/**
 * A link to one try-out page, which carries the attempt of the page when one is
 * open. An address that names no try-out page renders nothing, so a row never
 * links to a route that does not exist.
 */
export function TryoutPageLink({
  attemptId,
  preload,
  publicPath,
  ...anchor
}: Omit<ComponentProps<"a">, "href" | "target"> & {
  readonly attemptId?: string | undefined;
  readonly preload?: LinkPreload | undefined;
  readonly publicPath: string;
}) {
  return Option.match(getTryoutPageTarget({ attemptId, publicPath }), {
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
