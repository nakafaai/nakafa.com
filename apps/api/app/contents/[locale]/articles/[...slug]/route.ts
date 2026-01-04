import { getContents } from "@repo/contents/_lib/content";
import {
  FileReadError,
  GitHubFetchError,
  InvalidPathError,
  MetadataParseError,
} from "@repo/contents/_shared/error";
import { createServiceLogger, logError } from "@repo/utilities/logging";
import { Effect } from "effect";
import { NextResponse } from "next/server";
import { generateStaticParamsForContent } from "@/lib/static-params";

export const revalidate = false;

const logger = createServiceLogger("api-contents");

export function generateStaticParams() {
  return generateStaticParamsForContent({
    basePath: "articles",
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ locale: string; slug: string[] }> }
) {
  const { locale, slug } = await params;

  const basePath = slug.join("/");

  const cleanPath = `articles/${basePath}` as const;

  const program = getContents({
    locale,
    basePath: cleanPath,
    includeMDX: false,
  });

  const response = await Effect.runPromise(
    Effect.match(program, {
      onFailure: (error: unknown) => {
        logError(
          logger,
          error instanceof Error ? error : new Error(String(error)),
          {
            locale,
            basePath: basePath || "/",
            slugLength: slug.length,
            message: "Failed to fetch contents.",
          }
        );

        const statusCode =
          error instanceof InvalidPathError ||
          error instanceof FileReadError ||
          error instanceof MetadataParseError ||
          error instanceof GitHubFetchError
            ? 404
            : 500;

        return NextResponse.json(
          { error: "Failed to fetch contents." },
          { status: statusCode }
        );
      },
      onSuccess: (data) => NextResponse.json(data),
    })
  );

  return response;
}
