"use client";

import {
  DestinationLink,
  type LinkPreload,
} from "@repo/internationalization/src/link";
import {
  addressTarget,
  publicPathTarget,
} from "@repo/internationalization/src/target";
import type { ActiveOptions } from "@tanstack/react-router";
import { Option } from "effect";
import type { ComponentProps } from "react";

/**
 * A link to one signed public path of the content: an article, a curriculum page,
 * a material, a surah, or a Page. A path that names no page renders nothing, so a
 * row never links to an empty address.
 */
export function PublicPathLink({
  activeOptions,
  context,
  hash,
  preload,
  publicPath,
  ...anchor
}: Omit<ComponentProps<"a">, "href" | "target"> & {
  readonly activeOptions?: ActiveOptions | undefined;
  readonly context?: string | undefined;
  /** The fragment of the page that the link opens, without its `#`. */
  readonly hash?: string | undefined;
  readonly preload?: LinkPreload | undefined;
  readonly publicPath: string;
}) {
  return Option.match(
    Option.fromNullishOr(publicPathTarget(publicPath, context)),
    {
      onNone: () => null,
      onSome: (target) => (
        <DestinationLink
          {...anchor}
          {...(activeOptions === undefined ? {} : { activeOptions })}
          {...(preload === undefined ? {} : { preload })}
          {...(hash === undefined ? {} : { hash })}
          destination={target}
        />
      ),
    }
  );
}

/**
 * A link to the URL of an app address that a backend query returns, such as
 * `/en/curriculum/merdeka`. An address that names no page renders nothing.
 */
export function AddressLink({
  address,
  ...anchor
}: Omit<ComponentProps<"a">, "href" | "target"> & {
  readonly address: string;
}) {
  return Option.match(Option.fromNullishOr(addressTarget(address)), {
    onNone: () => null,
    onSome: (target) => <DestinationLink {...anchor} destination={target} />,
  });
}
