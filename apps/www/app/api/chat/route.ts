import {
  DEFAULT_LATITUDE,
  DEFAULT_LONGITUDE,
} from "@repo/ai/clients/weather/client";
import { hasEnoughCredits, MODEL_IDS } from "@repo/ai/config/models";
import { compressMessages } from "@repo/ai/lib/utils";
import type { MyUIMessage } from "@repo/ai/types/message";
import { captureServerException } from "@repo/analytics/posthog/server";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { LocaleSchema } from "@repo/contents/_types/content";
import { CorsValidator } from "@repo/security/lib/cors-validator";
import { cleanSlug } from "@repo/utilities/helper";
import { createChildLogger, logError } from "@repo/utilities/logging";
import { geolocation } from "@vercel/functions";
import { convertToModelMessages, createUIMessageStreamResponse } from "ai";
import { Effect } from "effect";
import { getTranslations } from "next-intl/server";
import * as z from "zod";
import { CHAT_ERRORS } from "@/app/api/chat/constants";
import { determinePageFetchNeed } from "@/app/api/chat/content";
import { loadMessages, saveOrCreateChat } from "@/app/api/chat/persistence";
import { streamChat } from "@/app/api/chat/stream";
import { getUserInfo, getVerified } from "@/app/api/chat/utils";
import { getToken } from "@/lib/auth/server";

const ModelIdSchema = z.enum(MODEL_IDS);

// Allow streaming responses up to 60 seconds
export const maxDuration = 60;

const corsValidator = new CorsValidator();

const possibleVerifiedUrls = [
  "/articles",
  "/quran",
  "/subject",
  "/exercises",
] as const;

/**
 * POST /api/chat
 *
 * Handles an incoming chat message from the client. Validates the request,
 * gates on user credits, persists the user message, then streams the
 * assistant response back using the AI SDK UI message stream protocol.
 *
 * After the stream finishes, two fire-and-forget tasks run via `waitUntil`:
 * - Title generation (first message only)
 * - Assistant response persistence and credit deduction
 */
export async function POST(req: Request) {
  if (!corsValidator.isRequestFromAllowedDomain(req)) {
    return corsValidator.createForbiddenResponse();
  }

  const {
    message,
    id,
    locale: rawLocale,
    slug,
    model: rawModel,
  }: {
    message: MyUIMessage | undefined;
    id: Id<"chats"> | undefined;
    locale: unknown;
    slug: string;
    model: unknown;
  } = await req.json();

  const localeResult = LocaleSchema.safeParse(rawLocale);
  if (!localeResult.success) {
    return new Response(CHAT_ERRORS.BAD_REQUEST.code, {
      status: CHAT_ERRORS.BAD_REQUEST.status,
    });
  }
  const locale = localeResult.data;

  const modelResult = ModelIdSchema.safeParse(rawModel);
  if (!modelResult.success) {
    return new Response(CHAT_ERRORS.BAD_REQUEST.code, {
      status: CHAT_ERRORS.BAD_REQUEST.status,
    });
  }
  const selectedModel = modelResult.data;

  const token = await getToken();
  if (!token) {
    return new Response(CHAT_ERRORS.UNAUTHORIZED.code, {
      status: CHAT_ERRORS.UNAUTHORIZED.status,
    });
  }

  if (!message) {
    return new Response(CHAT_ERRORS.BAD_REQUEST.code, {
      status: CHAT_ERRORS.BAD_REQUEST.status,
    });
  }

  const url = `/${locale}/${cleanSlug(slug)}`;
  const shouldVerify = possibleVerifiedUrls.some((segment) =>
    url.includes(segment)
  );

  const currentDate = new Date().toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });

  const geo = geolocation(req);
  const userLocation = {
    latitude: geo.latitude ?? DEFAULT_LATITUDE,
    longitude: geo.longitude ?? DEFAULT_LONGITUDE,
    city: geo.city ?? "Unknown",
    countryRegion: geo.countryRegion ?? "Unknown",
    country: geo.country ?? "Unknown",
  };

  const [verified, userInfo] = await Promise.all([
    shouldVerify ? getVerified(url) : Promise.resolve(false),
    getUserInfo(token),
  ]);

  if (!hasEnoughCredits(userInfo.credits, selectedModel)) {
    return new Response(CHAT_ERRORS.INSUFFICIENT_CREDITS.code, {
      status: CHAT_ERRORS.INSUFFICIENT_CREDITS.status,
    });
  }

  const sessionLogger = createChildLogger({
    service: "chat-api",
    currentPage: {
      locale,
      slug: cleanSlug(slug),
      url,
      verified,
    },
    currentDate,
    userLocation,
    userRole: userInfo.role,
    url,
  });

  /**
   * Forward one chat-route runtime error to PostHog without interrupting the
   * user-facing stream or background persistence flow.
   *
   * Related docs:
   * https://posthog.com/docs/error-tracking/capture
   * https://posthog.com/docs/error-tracking/installation/nextjs
   */
  function reportChatErrorToPostHog(error: unknown, source: string) {
    captureServerException(error, userInfo.userId, { source }).catch(
      (captureError) => {
        logError(
          sessionLogger,
          captureError instanceof Error
            ? captureError
            : new Error(String(captureError)),
          {
            errorLocation: "posthog-capture",
            source,
          }
        );
      }
    );
  }

  const chatId = await saveOrCreateChat({
    chatId: id,
    message,
    modelId: selectedModel,
    token,
  });
  const messages = await loadMessages({ chatId, token });
  const isFirstMessage = messages.length === 1;

  const originalMessageCount = messages.length;
  const { messages: compressedMessages, tokens } = compressMessages(messages);
  const needsPageFetch = Effect.runSync(
    determinePageFetchNeed({ messages: compressedMessages, url, verified })
  );

  if (compressedMessages.length < originalMessageCount) {
    sessionLogger.warn(
      `Messages compressed from ${originalMessageCount} to ${compressedMessages.length} messages (${tokens} tokens) to stay within token limit`
    );
  } else {
    sessionLogger.info(
      `All ${originalMessageCount} messages fit within token limit (${tokens} tokens)`
    );
  }

  const finalMessages = await convertToModelMessages(compressedMessages);

  sessionLogger.info("Chat session started");

  const translate = await getTranslations({ locale, namespace: "Ai" });
  const chat = {
    finalMessages,
    id: chatId,
    isFirstMessage,
    messages: compressedMessages,
    token,
  };
  const page = {
    locale,
    needsFetch: needsPageFetch,
    slug,
    url,
    verified,
  };
  const runtime = {
    currentDate,
    logger: sessionLogger,
    modelId: selectedModel,
    reportError: reportChatErrorToPostHog,
    translate,
  };
  const user = {
    info: userInfo,
    location: userLocation,
  };
  const stream = streamChat({ chat, page, runtime, user });

  return createUIMessageStreamResponse({ stream });
}
