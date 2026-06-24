import { NakafaSearch } from "@repo/ai/agents/nakafa/search";
import { Nakafa } from "@repo/ai/agents/nakafa/service";
import {
  DEFAULT_LATITUDE,
  DEFAULT_LONGITUDE,
} from "@repo/ai/clients/weather/client";
import { hasEnoughCredits, ModelIdSchema } from "@repo/ai/config/model";
import { NinaHarness } from "@repo/ai/nina/harness/stream";
import { NinaReporter } from "@repo/ai/nina/runtime/report";
import { NinaStore } from "@repo/ai/nina/runtime/store";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { LocaleSchema } from "@repo/contents/_types/content";
import { CasEngine } from "@repo/math/cas/engine";
import { MathWorkRepository } from "@repo/math/reason/repo";
import { CorsValidator } from "@repo/security/lib/cors-validator";
import { cleanSlug } from "@repo/utilities/helper";
import { geolocation } from "@vercel/functions";
import { Effect, Option, Schema } from "effect";
import { getTranslations } from "next-intl/server";
import { CHAT_ERRORS } from "@/app/api/chat/constants";
import { getCanonicalCurrentPageContentUrl } from "@/app/api/chat/content";
import { resolveNinaLearningSession } from "@/app/api/chat/context";
import { createMathWorkRepository } from "@/app/api/chat/math";
import { search as nakafaSearch } from "@/app/api/chat/nakafa";
import { nakafaContent } from "@/app/api/chat/nakafa-content";
import { createChatErrorReporter } from "@/app/api/chat/observability";
import {
  createChatWithMessage,
  loadPinnedNinaContext,
  saveChatMessage,
} from "@/app/api/chat/persistence";
import { createNinaStore } from "@/app/api/chat/store";
import {
  getLearningProfile,
  getUserInfo,
  getVerified,
} from "@/app/api/chat/utils";
import { getToken } from "@/lib/auth/server";

const corsValidator = new CorsValidator();

const possibleVerifiedUrls = [
  "/articles",
  "/quran",
  "/curriculum",
  "/kurikulum",
  "/subjects",
  "/materi",
  "/practice",
  "/latihan",
] as const;

/**
 * Keeps the streamed chat route aligned with the longest normal AI SDK chat
 * timeout. Vercel uses this route segment config to set the function limit.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config#maxduration
 * @see https://vercel.com/docs/functions/configuring-functions/duration
 */
export const maxDuration = 300;

/**
 * POST /api/chat
 *
 * Handles an incoming chat message from the client. Validates the request,
 * gates on user credits, persists the user message, then delegates response
 * streaming to the package-owned NinaHarness.
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
        context,
        locale: rawLocale,
        slug,
        model: rawModel,
      }: {
        message: MyUIMessage | undefined;
        id: Id<"chats"> | undefined;
        context: unknown;
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

      const url = getCanonicalCurrentPageContentUrl({ locale, slug });
      const shouldVerify = possibleVerifiedUrls.some((segment) =>
        url.includes(segment)
      );

      const capturedAt = new Date();
      const currentDate = capturedAt.toLocaleString("en-US", {
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

      const [verified, userInfo, learningProfile] = yield* Effect.all([
        shouldVerify ? getVerified(url) : Effect.succeed(false),
        getUserInfo(token),
        getLearningProfile(token, locale),
      ]);
      if (!hasEnoughCredits(userInfo.credits, selectedModel)) {
        return new Response(CHAT_ERRORS.INSUFFICIENT_CREDITS.code, {
          status: CHAT_ERRORS.INSUFFICIENT_CREDITS.status,
        });
      }

      const pinnedContext =
        id && !verified
          ? yield* loadPinnedNinaContext({
              chatId: id,
              messageIdentifier: message.id,
              token,
            })
          : undefined;
      const ninaSession = yield* resolveNinaLearningSession({
        capturedAt: capturedAt.toISOString(),
        locale,
        ...(pinnedContext ? { pinnedContext } : {}),
        rawContext: context,
        slug,
        url,
        verified,
      });

      const logContext = {
        service: "chat-api",
        currentPage: {
          locale,
          slug: cleanSlug(slug),
          url,
          verified,
        },
        currentDate,
        ninaContext: ninaSession.context.snapshot,
        userLocation,
        userRole: userInfo.role,
        url,
      };

      let chatId: Id<"chats">;

      if (id) {
        chatId = yield* saveChatMessage({
          chatId: id,
          message,
          modelId: selectedModel,
          ninaContextSnapshot: ninaSession.context.snapshot,
          ninaContextTransition: ninaSession.context.transition,
          token,
        });
      } else {
        chatId = yield* createChatWithMessage({
          message,
          modelId: selectedModel,
          ninaContextSnapshot: ninaSession.context.snapshot,
          ninaContextTransition: ninaSession.context.transition,
          token,
        });
      }
      const reportChatError = createChatErrorReporter({
        chatId,
        logContext,
        modelId: selectedModel,
        userId: userInfo.userId,
      });

      const translate = yield* Effect.tryPromise(() =>
        getTranslations({ locale, namespace: "Ai" })
      );

      return yield* NinaHarness.stream({
        copy: {
          errorMessage: translate("error-message"),
          rateLimitMessage: translate("rate-limit-message"),
        },
        page: {
          locale,
          needsFetch: false,
          nina: ninaSession.context,
          slug,
          url,
          verified,
        },
        runtime: {
          currentDate,
          modelId: selectedModel,
        },
        user: {
          ...(learningProfile ? { learningProfile } : {}),
          ...(userInfo.role ? { role: userInfo.role } : {}),
          location: userLocation,
        },
      }).pipe(
        Effect.provide(NinaHarness.Default),
        Effect.provideService(
          NinaStore,
          createNinaStore({
            chatId,
            modelId: selectedModel,
            reportError: reportChatError,
            token,
          })
        ),
        Effect.provideService(NinaReporter, {
          report: ({ error, source }) =>
            Effect.sync(() => reportChatError(error, source)),
        }),
        Effect.provide(CasEngine.Default),
        Effect.provideService(
          MathWorkRepository,
          createMathWorkRepository({ chatId, token })
        ),
        Effect.provideService(Nakafa, nakafaContent),
        Effect.provideService(NakafaSearch, nakafaSearch)
      );
    })
  );
}
