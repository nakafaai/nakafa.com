import { createFileRoute } from "@tanstack/react-router";
import { UserSettingsProfilePage } from "@/components/user/settings/profile";
import { privateHead } from "@/lib/account/head";
import { settingsScreenFn } from "@/lib/account/settings.fn";

export const Route = createFileRoute("/$locale/_app/_account/user/settings/")({
  loader: ({ params }) => settingsScreenFn({ data: { locale: params.locale } }),
  head: ({ loaderData }) => loaderData && privateHead(loaderData.seo),
  component: SettingsPage,
});

function SettingsPage() {
  const { account } = Route.useLoaderData();
  return <UserSettingsProfilePage initialAccount={account} />;
}
