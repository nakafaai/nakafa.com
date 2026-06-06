import {
  DEFAULT_LATITUDE,
  DEFAULT_LONGITUDE,
} from "@repo/ai/clients/weather/client";
import { hasEnoughCredits, ModelIdSchema } from "@repo/ai/config/model";
import { compressMessages } from "@repo/ai/lib/message";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { LocaleSchema } from "@repo/contents/_types/content";
import { CorsValidator } from "@repo/security/lib/cors-validator";
import { cleanSlug } from "@repo/utilities/helper";
import { geolocation } from "@vercel/functions";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  pruneMessages,
} from "ai";
import { Effect, Option, Schema } from "effect";
import { getTranslations } from "next-intl/server";
import { CHAT_ERRORS } from "@/app/api/chat/constants";
import { determinePageFetchNeed } from "@/app/api/chat/content";
import { createChatErrorReporter } from "@/app/api/chat/observability";
import { loadMessages, saveOrCreateChat } from "@/app/api/chat/persistence";
import { streamChat } from "@/app/api/chat/stream";
import { getUserInfo, getVerified } from "@/app/api/chat/utils";
import { getToken } from "@/lib/auth/server";

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
 *
 * @see https://ai-sdk.dev/docs/reference/ai-sdk-ui/convert-to-model-messages
 * @see https://ai-sdk.dev/docs/reference/ai-sdk-ui/create-ui-message-stream-response
 */
export function POST(req: Request) {
  return Effect.runPromise(
    Effect.gen(function* () {
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
      } = yield* Effect.tryPromise(() => req.json());

      const localeResult = Schema.decodeUnknownOption(LocaleSchema)(rawLocale);
      if (Option.isNone(localeResult)) {
        return new Response(CHAT_ERRORS.BAD_REQUEST.code, {
          status: CHAT_ERRORS.BAD_REQUEST.status,
        });
      }
      const locale = localeResult.value;

      const modelResult = Schema.decodeUnknownOption(ModelIdSchema)(rawModel);
      if (Option.isNone(modelResult)) {
        return new Response(CHAT_ERRORS.BAD_REQUEST.code, {
          status: CHAT_ERRORS.BAD_REQUEST.status,
        });
      }
      const selectedModel = modelResult.value;

      const token = yield* Effect.tryPromise(() => getToken());
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

      const [verified, userInfo] = yield* Effect.all([
        shouldVerify ? getVerified(url) : Effect.succeed(false),
        getUserInfo(token),
      ]);

      if (!hasEnoughCredits(userInfo.credits, selectedModel)) {
        return new Response(CHAT_ERRORS.INSUFFICIENT_CREDITS.code, {
          status: CHAT_ERRORS.INSUFFICIENT_CREDITS.status,
        });
      }

      const logContext = {
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
      };

      const chatId = yield* saveOrCreateChat({
        chatId: id,
        message,
        modelId: selectedModel,
        token,
      });
      const reportChatError = createChatErrorReporter({
        chatId,
        logContext,
        modelId: selectedModel,
        userId: userInfo.userId,
      });

      const messages = yield* loadMessages({ chatId, token });
      const isFirstMessage = messages.length === 1;

      const originalMessageCount = messages.length;
      const { messages: compressedMessages, tokens } =
        compressMessages(messages);
      const needsPageFetch = yield* determinePageFetchNeed({
        messages: compressedMessages,
        url,
        verified,
      });

      if (compressedMessages.length < originalMessageCount) {
        yield* Effect.logWarning(
          `Messages compressed from ${originalMessageCount} to ${compressedMessages.length} messages (${tokens} tokens) to stay within token limit`
        ).pipe(Effect.annotateLogs(logContext));
      } else {
        yield* Effect.logInfo(
          `All ${originalMessageCount} messages fit within token limit (${tokens} tokens)`
        ).pipe(Effect.annotateLogs(logContext));
      }

      const modelMessages = yield* Effect.tryPromise(() =>
        convertToModelMessages(compressedMessages)
      );
      // Persist and render reasoning in UI, but do not feed historical
      // assistant reasoning back into the next LLM call. AI SDK documents this
      // as the supported way to reduce model context without deleting stored UI
      // messages.
      // https://ai-sdk.dev/docs/reference/ai-sdk-ui/prune-messages
      // https://github.com/vercel/ai/blob/main/packages/ai/src/generate-text/prune-messages.ts
      const finalMessages = pruneMessages({
        messages: modelMessages,
        reasoning: "all",
      });

      yield* Effect.logInfo("Chat session started").pipe(
        Effect.annotateLogs(logContext)
      );

      const translate = yield* Effect.tryPromise(() =>
        getTranslations({ locale, namespace: "Ai" })
      );
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
        logContext,
        modelId: selectedModel,
        reportError: reportChatError,
        translate,
      };
      const user = {
        info: userInfo,
        location: userLocation,
      };
      const stream = streamChat({ chat, page, runtime, user });

      return createUIMessageStreamResponse({ stream });
    })
  );
}
