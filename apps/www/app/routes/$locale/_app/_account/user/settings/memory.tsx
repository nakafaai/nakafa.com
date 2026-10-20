import { createFileRoute } from "@tanstack/react-router";
import { UserSettingsMemory } from "@/components/user/settings/memory/view";
import { signedInHead } from "@/lib/account/head";
import { memoryScreenFn } from "@/lib/account/screens.fn";

export const Route = createFileRoute(
  "/$locale/_app/_account/user/settings/memory"
)({
  loader: ({ params }) => memoryScreenFn({ data: { locale: params.locale } }),
  head: ({ loaderData }) => loaderData && signedInHead(loaderData.seo),
  component: MemoryPage,
});

function MemoryPage() {
  const { first, now, paused } = Route.useLoaderData();
  return <UserSettingsMemory first={first} now={now} paused={paused} />;
}
