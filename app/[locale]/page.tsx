import { setRequestLocale } from "next-intl/server";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function IndexPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  // TODO: Implement search of content, like google search
  return null;
}
