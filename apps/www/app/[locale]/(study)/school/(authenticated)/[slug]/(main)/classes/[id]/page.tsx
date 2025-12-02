import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";

type Props = {
  params: Promise<{ locale: Locale; id: Id<"schoolClasses"> }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const defaultMetadata = {};
  // Use try-catch to handle errors gracefully when title is not found
  try {
    const title = await fetchQuery(api.classes.queries.getClassName, {
      classId: id,
    });
    if (!title) {
      return defaultMetadata;
    }
    return {
      title: {
        absolute: title,
      },
    };
  } catch {
    return defaultMetadata;
  }
}

export default function Page({ params }: Props) {
  const { locale } = use(params);

  setRequestLocale(locale);

  return <div className="size-full overflow-y-auto overflow-x-hidden" />;
}
