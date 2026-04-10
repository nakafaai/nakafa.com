import { redirect } from "@repo/internationalization/src/navigation";

import { use } from "react";
import { getLocaleOrThrow } from "@/lib/i18n/params";

export default function Page(props: PageProps<"/[locale]/home">) {
  const { params } = props;
  const locale = getLocaleOrThrow(use(params).locale);

  // This is empty page, redirect to home page
  redirect({ href: "/about", locale });
}
