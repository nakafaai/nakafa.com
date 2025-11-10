import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { UserComments } from "@/components/user/comments";

type Props = {
  params: Promise<{
    locale: Locale;
    id: Id<"users">;
  }>;
};

export default function Page({ params }: Props) {
  const { locale, id } = use(params);

  // Enable static rendering
  setRequestLocale(locale);

  return <UserComments userId={id} />;
}
