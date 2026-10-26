import { ReportHash } from "@repo/backend/confect/records/report";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option, Schema } from "effect";
import type { ReactElement } from "react";
import { ReportCheck } from "@/components/records/check";
import { checkReportFn } from "@/lib/records/check.functions";

/** The hash the check page's address names, or none for an address that names no hash. */
const readHash = Schema.decodeUnknownOption(ReportHash);

/**
 * The public check of a report card's QR code (ADR 0033, S5), on the main site and outside
 * every school host. The loader checks the hash on the server, so the answer is in the first
 * HTML. An address that names no hash is not found.
 */
export const Route = createFileRoute("/$locale/_entry/verify/$hash")({
  beforeLoad: ({ params }) => {
    const hash = readHash(params.hash);
    if (Option.isNone(hash)) {
      throw notFound();
    }
    return { hash: hash.value };
  },
  loader: ({ context }) => checkReportFn({ data: { hash: context.hash } }),
  head: () => ({ meta: [{ content: "noindex", name: "robots" }] }),
  component: ReportCheckPage,
});

function ReportCheckPage(): ReactElement {
  const answer = Route.useLoaderData();
  return <ReportCheck answer={answer} />;
}
