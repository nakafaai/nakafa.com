import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { getAppSocialArtwork } from "@/lib/og/app-artwork";

export async function generateMetadata({
  params,
}: {
  params: LayoutProps<"/[locale]/school">["params"];
}): Promise<Metadata> {
  const locale = getLocaleOrThrow((await params).locale);

  const t = await getTranslations({
    locale,
    namespace: "Metadata",
  });
  const image = getAppSocialArtwork({
    key: "school",
    locale,
    publicPath: "school",
  });

  return {
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
      images: [
        {
          url: image,
          alt: t("title"),
          width: 1200,
          height: 630,
        },
      ],
      creator: "@nabilfatih_",
      site: "@nabilfatih_",
    },
    openGraph: {
      title: t("title"),
      description: t("description"),
      url: `https://nakafa.com/${locale}/school`,
      siteName: "Nakafa School",
      locale,
      type: "website",
      images: [
        {
          url: image,
          alt: t("title"),
          width: 1200,
          height: 630,
        },
      ],
    },
  };
}

/** Renders the school subtree after locale and metadata setup. */
export default function Layout({ children }: LayoutProps<"/[locale]/school">) {
  return children;
}
