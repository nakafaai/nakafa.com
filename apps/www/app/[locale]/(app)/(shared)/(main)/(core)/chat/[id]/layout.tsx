import { HttpClient } from "@confect/js";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import chats from "@repo/backend/confect/_generated/refs/chats";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect, Option, Schema } from "effect";
import type { Metadata } from "next";
import { cache } from "react";
import { captureServerExceptionSafely } from "@/lib/analytics/server";
import { getToken } from "@/lib/auth/server";
import { httpLayer } from "@/lib/convex/http";

/** Loads the current chat title once per request for metadata generation. */
const getChatTitle = cache(async (id: Id<"chats">) => {
  const token = await getToken();
  return await Effect.runPromise(
    Effect.flatMap(HttpClient.HttpClient, (client) =>
      client.query(chats.queries.getChatTitle, {
        chatId: id,
      })
    ).pipe(
      Effect.provide(httpLayer(token ? { auth: token } : {})),
      Effect.withTracerTiming(false)
    )
  );
});

/** Generates the metadata for one authenticated chat route. */
export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/chat/[id]">["params"];
}): Promise<Metadata> {
  const { id } = await params;
  const defaultMetadata = {};
  const chatId = Schema.decodeUnknownOption(IdSchema("chats"))(id);
  if (Option.isNone(chatId)) {
    return defaultMetadata;
  }
  const title = await Effect.runPromise(
    Effect.tryPromise(() => getChatTitle(chatId.value)).pipe(
      Effect.catchTag("UnknownError", ({ cause: error }) =>
        Effect.gen(function* () {
          yield* captureServerExceptionSafely(error, {
            source: "chat-page-metadata",
          });
          return null;
        })
      )
    )
  );
  if (!title) {
    return defaultMetadata;
  }
  return {
    title: {
      absolute: title,
    },
  };
}

/** Keeps per-chat document metadata independent of client navigation. */
export default function Layout({
  children,
}: LayoutProps<"/[locale]/chat/[id]">) {
  return children;
}
