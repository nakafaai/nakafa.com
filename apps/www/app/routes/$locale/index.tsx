import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/$locale/")({
  component: LocaleIndexPage,
});

function LocaleIndexPage() {
  return <h1>Nakafa</h1>;
}
