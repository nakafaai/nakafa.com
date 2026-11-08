import { createFileRoute } from "@tanstack/react-router";
import { UserSettingsMemory } from "@/components/user/settings/memory/view";
import { UserSettingsPage } from "@/components/user/settings/section";
import { privateHead } from "@/lib/account/head";
import { memoryScreenFn } from "@/lib/account/settings.functions";

export const Route = createFileRoute(
  "/$locale/_main/_app/_account/user/settings/memory"
)({
  loader: ({ params }) => memoryScreenFn({ data: { locale: params.locale } }),
  head: ({ loaderData }) =>
    loaderData === undefined ? {} : privateHead(loaderData.seo),
  component: MemoryPage,
});

function MemoryPage() {
  const { first, now, paused } = Route.useLoaderData();
  return (
    <UserSettingsPage>
      <UserSettingsMemory first={first} now={now} paused={paused} />
    </UserSettingsPage>
  );
}
