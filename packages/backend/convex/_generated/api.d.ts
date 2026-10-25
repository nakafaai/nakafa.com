/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";
import type { GenericId as Id } from "convex/values";

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: {
  access: {
    grants: {
      assign: FunctionReference<
        "mutation",
        "public",
        {
          personId: Id<"tenantPeople">;
          role:
            | "owner"
            | "admin"
            | "principal"
            | "deputy"
            | "teacher"
            | "counselor"
            | "staff"
            | "student"
            | "guardian"
            | "proctor"
            | "auditor"
            | "integration";
          scope:
            { kind: "tenant" } | { kind: "unit"; unitId: Id<"tenantUnits"> };
          slug: string;
        },
        Id<"tenantGrants">
      >;
      list: FunctionReference<
        "query",
        "public",
        {
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          slug: string;
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            id: Id<"tenantGrants">;
            person: { id: Id<"tenantPeople">; name: string };
            role: {
              key:
                | "owner"
                | "admin"
                | "principal"
                | "deputy"
                | "teacher"
                | "counselor"
                | "staff"
                | "student"
                | "guardian"
                | "proctor"
                | "auditor"
                | "integration";
              kind: "builtin";
            };
            scope:
              { kind: "tenant" } | { kind: "unit"; unitId: Id<"tenantUnits"> };
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
      revoke: FunctionReference<
        "mutation",
        "public",
        { grantId: Id<"tenantGrants">; slug: string },
        null
      >;
    };
  };
  auth: {
    deletion: {
      cancelAccountDeletionAttempt: FunctionReference<
        "mutation",
        "public",
        { attemptId: string },
        "complete"
      >;
      getAccountDeletionAttemptStatus: FunctionReference<
        "query",
        "public",
        { attemptId: string },
        "committed" | "pending" | "unknown"
      >;
      prepareCurrentAccountDeletion: FunctionReference<
        "mutation",
        "public",
        { attemptId: string },
        "ready" | "temporarily-unavailable"
      >;
    };
    queries: {
      getCurrentUser: FunctionReference<
        "query",
        "public",
        {},
        {
          appUser: {
            _creationTime: number;
            _id: Id<"users">;
            authId: string;
            authVerificationCleanupCursor?: string;
            bio?: string;
            credits: number;
            creditsResetAt: number;
            deletedAt?: number;
            deletionCleanupStartedAt?: number;
            deletionPreparedAt?: number;
            email: string;
            image?: string;
            mascot: string;
            name: string;
            picture?: "animal" | "photo";
            plan: "free" | "pro";
            planCreditGrantId?: Id<"creditTransactions">;
            role?: "teacher" | "student" | "parent" | "administrator";
            username?: string;
          };
          authUser: {
            _id: string;
            email: string;
            image?: string | null;
            name: string;
          };
        } | null
      >;
      getUserById: FunctionReference<
        "query",
        "public",
        { userId: Id<"users"> },
        {
          image?: string;
          mascot: string;
          name: string;
          picture?: "animal" | "photo";
        } | null
      >;
    };
  };
  billing: {
    queries: {
      hasActiveSubscription: FunctionReference<"query", "public", {}, boolean>;
    };
    sessions: {
      generateCheckoutLink: FunctionReference<
        "action",
        "public",
        { locale: "en" | "id" | "de"; successUrl: string },
        { url: string }
      >;
      generateCustomerPortalUrl: FunctionReference<
        "action",
        "public",
        {},
        { url: string }
      >;
    };
  };
  chats: {
    mutations: {
      deleteChat: FunctionReference<
        "mutation",
        "public",
        { chatId: Id<"chats"> },
        null
      >;
      updateChatTitle: FunctionReference<
        "mutation",
        "public",
        { chatId: Id<"chats">; title: string },
        Id<"chats">
      >;
      updateChatVisibility: FunctionReference<
        "mutation",
        "public",
        { chatId: Id<"chats">; visibility: "private" | "public" },
        Id<"chats">
      >;
    };
    queries: {
      getChat: FunctionReference<
        "query",
        "public",
        { chatId: Id<"chats">; shareToken?: string },
        {
          _creationTime: number;
          _id: Id<"chats">;
          activeTurnId?: Id<"ninaTurns">;
          threadId: string;
          title?: string;
          type: "study";
          updatedAt: number;
          userId?: Id<"users">;
          visibility: "private" | "public";
        }
      >;
      getChatTitle: FunctionReference<
        "query",
        "public",
        { chatId: Id<"chats"> },
        string | null
      >;
      getOwnChats: FunctionReference<
        "query",
        "public",
        {
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          q?: string;
          type?: "study";
          visibility?: "private" | "public";
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            _creationTime: number;
            _id: Id<"chats">;
            activeTurnId?: Id<"ninaTurns">;
            threadId: string;
            title?: string;
            type: "study";
            updatedAt: number;
            userId?: Id<"users">;
            visibility: "private" | "public";
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
      getShareToken: FunctionReference<
        "query",
        "public",
        { chatId: Id<"chats"> },
        string | null
      >;
    };
  };
  classroom: {
    classes: {
      archive: FunctionReference<
        "mutation",
        "public",
        { classId: Id<"classes">; slug: string },
        {
          cohortId: Id<"tenantCohorts">;
          id: Id<"classes">;
          name: string;
          periodId: Id<"tenantPeriods">;
          slug: string;
          status: "active" | "archived";
          subject?: string;
        }
      >;
      create: FunctionReference<
        "mutation",
        "public",
        { cohortId: Id<"tenantCohorts">; slug: string; subject?: string },
        {
          cohortId: Id<"tenantCohorts">;
          id: Id<"classes">;
          name: string;
          periodId: Id<"tenantPeriods">;
          slug: string;
          status: "active" | "archived";
          subject?: string;
        }
      >;
      get: FunctionReference<
        "query",
        "public",
        { classId: Id<"classes">; slug: string },
        {
          cohortId: Id<"tenantCohorts">;
          id: Id<"classes">;
          name: string;
          periodId: Id<"tenantPeriods">;
          slug: string;
          status: "active" | "archived";
          subject?: string;
        }
      >;
      list: FunctionReference<
        "query",
        "public",
        {
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          periodId: Id<"tenantPeriods">;
          slug: string;
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            cohortId: Id<"tenantCohorts">;
            id: Id<"classes">;
            name: string;
            periodId: Id<"tenantPeriods">;
            slug: string;
            status: "active" | "archived";
            subject?: string;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
      mine: FunctionReference<
        "query",
        "public",
        { slug: string },
        Array<{
          cohortId: Id<"tenantCohorts">;
          id: Id<"classes">;
          name: string;
          periodId: Id<"tenantPeriods">;
          slug: string;
          status: "active" | "archived";
          subject?: string;
        }>
      >;
      rename: FunctionReference<
        "mutation",
        "public",
        { classId: Id<"classes">; name: string; slug: string },
        {
          cohortId: Id<"tenantCohorts">;
          id: Id<"classes">;
          name: string;
          periodId: Id<"tenantPeriods">;
          slug: string;
          status: "active" | "archived";
          subject?: string;
        }
      >;
      resolve: FunctionReference<
        "query",
        "public",
        { classSlug: string; slug: string },
        {
          can: Array<
            | "class.manage"
            | "class.view"
            | "forum.manage"
            | "forum.read"
            | "grade.enter"
            | "grade.list"
          >;
          cohortId: Id<"tenantCohorts">;
          id: Id<"classes">;
          name: string;
          periodId: Id<"tenantPeriods">;
          slug: string;
          status: "active" | "archived";
          subject?: string;
        }
      >;
    };
    forum: {
      channels: {
        add: FunctionReference<
          "mutation",
          "public",
          { classId: Id<"classes">; name: string; slug: string },
          {
            id: Id<"classroomChannels">;
            kind: "general" | "topic";
            name: string;
          }
        >;
        list: FunctionReference<
          "query",
          "public",
          {
            classId: Id<"classes">;
            paginationOpts: {
              cursor: string | null;
              endCursor?: string | null;
              id?: number;
              maximumBytesRead?: number;
              maximumRowsRead?: number;
              numItems: number;
            };
            slug: string;
          },
          {
            continueCursor: string;
            isDone: boolean;
            page: Array<{
              id: Id<"classroomChannels">;
              kind: "general" | "topic";
              name: string;
            }>;
            pageStatus?: "SplitRecommended" | "SplitRequired" | null;
            splitCursor?: string | null;
          }
        >;
      };
    };
    teachers: {
      assign: FunctionReference<
        "mutation",
        "public",
        { classId: Id<"classes">; personId: Id<"tenantPeople">; slug: string },
        { id: Id<"tenantPeople">; name: string }
      >;
      list: FunctionReference<
        "query",
        "public",
        {
          classId: Id<"classes">;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          slug: string;
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{ id: Id<"tenantPeople">; name: string }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
      remove: FunctionReference<
        "mutation",
        "public",
        { classId: Id<"classes">; personId: Id<"tenantPeople">; slug: string },
        { id: Id<"tenantPeople"> }
      >;
    };
  };
  comments: {
    mutations: {
      addComment: FunctionReference<
        "mutation",
        "public",
        { parentId?: Id<"comments">; slug: string; text: string },
        Id<"comments">
      >;
      deleteComment: FunctionReference<
        "mutation",
        "public",
        { commentId: Id<"comments"> },
        null
      >;
      likeComment: FunctionReference<
        "mutation",
        "public",
        { commentId: Id<"comments"> },
        null
      >;
      unlikeComment: FunctionReference<
        "mutation",
        "public",
        { commentId: Id<"comments"> },
        null
      >;
    };
    queries: {
      getCommentReplies: FunctionReference<
        "query",
        "public",
        {
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          threadId: Id<"comments">;
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            _creationTime: number;
            _id: Id<"comments">;
            likeCount: number;
            liked: boolean;
            parentId?: Id<"comments">;
            replyCount: number;
            replyToUser: {
              _id: Id<"users">;
              image?: string | null;
              mascot: string;
              name: string;
              picture?: "animal" | "photo";
            } | null;
            replyToUserId?: Id<"users">;
            slug: string;
            text: string;
            threadId?: Id<"comments">;
            user: {
              _id: Id<"users">;
              image?: string | null;
              mascot: string;
              name: string;
              picture?: "animal" | "photo";
            } | null;
            userId: Id<"users">;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
      getCommentsBySlug: FunctionReference<
        "query",
        "public",
        {
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          slug: string;
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            _creationTime: number;
            _id: Id<"comments">;
            likeCount: number;
            liked: boolean;
            parentId?: Id<"comments">;
            replyCount: number;
            replyToUser: {
              _id: Id<"users">;
              image?: string | null;
              mascot: string;
              name: string;
              picture?: "animal" | "photo";
            } | null;
            replyToUserId?: Id<"users">;
            slug: string;
            text: string;
            threadId?: Id<"comments">;
            user: {
              _id: Id<"users">;
              image?: string | null;
              mascot: string;
              name: string;
              picture?: "animal" | "photo";
            } | null;
            userId: Id<"users">;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
      getCommentsByUserId: FunctionReference<
        "query",
        "public",
        {
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          userId: Id<"users">;
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            _creationTime: number;
            _id: Id<"comments">;
            likeCount: number;
            liked: boolean;
            parentId?: Id<"comments">;
            replyCount: number;
            replyToUserId?: Id<"users">;
            slug: string;
            text: string;
            threadId?: Id<"comments">;
            userId: Id<"users">;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
    };
  };
  connectors: {
    connections: {
      disconnectOwn: FunctionReference<
        "mutation",
        "public",
        { connectionId: Id<"connectorConnections"> },
        null
      >;
      disconnectSchool: FunctionReference<
        "mutation",
        "public",
        { connectionId: Id<"connectorConnections">; slug: string },
        null
      >;
      listOwn: FunctionReference<
        "query",
        "public",
        {
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            connector:
              | "drive"
              | "forms"
              | "classroom"
              | "calendar"
              | "gmail"
              | "dapodik";
            createdAt: number;
            id: Id<"connectorConnections">;
            lastSyncedAt: number | null;
            nextSyncAt: number | null;
            scopes: Array<string>;
            status: "active" | "reconnect" | "disconnected";
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
      listSchool: FunctionReference<
        "query",
        "public",
        {
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          slug: string;
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            connector:
              | "drive"
              | "forms"
              | "classroom"
              | "calendar"
              | "gmail"
              | "dapodik";
            createdAt: number;
            id: Id<"connectorConnections">;
            lastSyncedAt: number | null;
            nextSyncAt: number | null;
            scopes: Array<string>;
            status: "active" | "reconnect" | "disconnected";
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
    };
  };
  consents: {
    current: {
      get: FunctionReference<
        "query",
        "public",
        { category: "analytics" },
        {
          currentNoticeVersion: "privacy-2026-08-22";
          decision:
            | null
            | {
                category: "analytics";
                decidedAt: number;
                granted: boolean;
                mechanism: "privacy-controls";
                noticeVersion: "privacy-2026-08-22" | "privacy-2026-08-21";
              }
            | {
                category: "analytics";
                decidedAt: number;
                granted: false;
                mechanism: "browser-privacy-signal";
                noticeVersion: "privacy-2026-08-22" | "privacy-2026-08-21";
              };
        }
      >;
      set: FunctionReference<
        "mutation",
        "public",
        {
          decision:
            | {
                category: "analytics";
                granted: boolean;
                mechanism: "privacy-controls";
                noticeVersion: "privacy-2026-08-22";
              }
            | {
                category: "analytics";
                granted: false;
                mechanism: "browser-privacy-signal";
                noticeVersion: "privacy-2026-08-22";
              };
          expectedUserId: Id<"users">;
        },
        | {
            category: "analytics";
            decidedAt: number;
            granted: boolean;
            mechanism: "privacy-controls";
            noticeVersion: "privacy-2026-08-22" | "privacy-2026-08-21";
          }
        | {
            category: "analytics";
            decidedAt: number;
            granted: false;
            mechanism: "browser-privacy-signal";
            noticeVersion: "privacy-2026-08-22" | "privacy-2026-08-21";
          }
      >;
    };
  };
  contentRelease: {
    article: {
      apiPage: FunctionReference<
        "query",
        "public",
        {
          appLocale: "en" | "id" | "de";
          cursor: string | null;
          limit: number;
          prefix: string;
        },
        {
          activeReleaseId: string;
          continueCursor: string;
          isDone: boolean;
          page: Array<{ appLocale: "en" | "id" | "de"; publicPath: string }>;
        }
      >;
      bucket: FunctionReference<
        "query",
        "public",
        { appLocale: "en" | "id" | "de"; bucket: string },
        {
          activeReleaseId: string | null;
          articles: Array<{
            articleSlug: string;
            authors: Array<{ name: string }>;
            category: string;
            categoryTitle: string;
            dateModified?: string;
            datePublished: string;
            description?: string;
            official: boolean;
            publicPath: string;
            route: { category: string; slug: string };
            title: string;
          }> | null;
          managed: boolean;
        }
      >;
      categories: FunctionReference<
        "query",
        "public",
        {
          appLocale: "en" | "id" | "de";
          expectedManifestHash: string | null;
          expectedReleaseId: string | null;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        {
          activeManifestHash: string | null;
          activeReleaseId: string | null;
          managed: boolean;
          result: {
            continueCursor: string;
            isDone: boolean;
            page: Array<{
              category: string;
              rendererDomain:
                | "ai-ds"
                | "biology"
                | "chemistry"
                | "mathematics"
                | "physics"
                | "politics"
                | "site"
                | "snbt-general"
                | "snbt-math"
                | "snbt-plain"
                | "snbt-quant"
                | "tka-math";
              route: string;
              title: string;
            }>;
            pageStatus?: "SplitRecommended" | "SplitRequired" | null;
            splitCursor?: string | null;
          };
          sourceRevision: string | null;
          stale: boolean;
        }
      >;
      delivery: FunctionReference<
        "query",
        "public",
        { appLocale: "en" | "id" | "de"; publicPath: string },
        {
          model: {
            activeAppLocales: Array<"en" | "id" | "de">;
            activeReleaseId: string;
            alternateJson: Array<string>;
            projectionJson: string | null;
          };
          runtimeJson: string | null;
        }
      >;
      latest: FunctionReference<
        "query",
        "public",
        { appLocale: "en" | "id" | "de"; limit: number },
        {
          activeReleaseId: string | null;
          articles: Array<{
            articleSlug: string;
            authors: Array<{ name: string }>;
            category: string;
            categoryTitle: string;
            dateModified?: string;
            datePublished: string;
            description?: string;
            official: boolean;
            publicPath: string;
            route: { category: string; slug: string };
            title: string;
          }>;
          managed: boolean;
        }
      >;
      listing: FunctionReference<
        "query",
        "public",
        { appLocale: "en" | "id" | "de"; category: string; limit: number },
        {
          activeReleaseId: string | null;
          articles: Array<{
            articleSlug: string;
            authors: Array<{ name: string }>;
            category: string;
            categoryTitle: string;
            dateModified?: string;
            datePublished: string;
            description?: string;
            official: boolean;
            publicPath: string;
            route: { category: string; slug: string };
            title: string;
          }>;
          managed: boolean;
        }
      >;
      publications: FunctionReference<
        "query",
        "public",
        {
          appLocale: "en" | "id" | "de";
          category: string;
          expectedManifestHash: string | null;
          expectedReleaseId: string | null;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        {
          activeManifestHash: string | null;
          activeReleaseId: string | null;
          managed: boolean;
          result: {
            continueCursor: string;
            isDone: boolean;
            page: Array<{
              appLocale: "en" | "id" | "de";
              artifactLocale: "en" | "id" | "de";
              contentKey: string;
              family: "article";
              projectionHash: string;
              projectionJson: string;
              publicPath: string;
              releaseId: string;
              rendererDomain:
                | "ai-ds"
                | "biology"
                | "chemistry"
                | "mathematics"
                | "physics"
                | "politics"
                | "site"
                | "snbt-general"
                | "snbt-math"
                | "snbt-plain"
                | "snbt-quant"
                | "tka-math";
              sequence: number;
              sourcePath: string;
            }>;
            pageStatus?: "SplitRecommended" | "SplitRequired" | null;
            splitCursor?: string | null;
          };
          sourceRevision: string | null;
          stale: boolean;
        }
      >;
      route: FunctionReference<
        "query",
        "public",
        {
          appLocale: "en" | "id" | "de";
          expectedActiveReleaseId?: string | null;
          publicPath: string;
        },
        {
          activeAppLocales: Array<"en" | "id" | "de">;
          activeReleaseId: string;
          alternateJson: Array<string>;
          projectionJson: string | null;
        }
      >;
      sitemapBuckets: FunctionReference<
        "query",
        "public",
        { appLocale: "en" | "id" | "de" },
        {
          activeReleaseId: string | null;
          articleCount: number;
          buckets: Array<string>;
          managed: boolean;
        }
      >;
      sitemapPage: FunctionReference<
        "query",
        "public",
        { appLocale: "en" | "id" | "de"; bucket: string },
        { routes: Array<{ lastModified?: string; publicPath: string }> } | null
      >;
    };
    material: {
      apiPage: FunctionReference<
        "query",
        "public",
        {
          appLocale: "en" | "id" | "de";
          cursor: string | null;
          limit: number;
          prefix: string;
        },
        {
          activeReleaseId: string;
          continueCursor: string;
          isDone: boolean;
          page: Array<{ appLocale: "en" | "id" | "de"; publicPath: string }>;
        }
      >;
      bucket: FunctionReference<
        "query",
        "public",
        { appLocale: "en" | "id" | "de"; bucket: string },
        {
          activeReleaseId: string | null;
          managed: boolean;
          materials: Array<{
            authors: Array<{ name: string }>;
            dateModified?: string;
            datePublished: string;
            description?: string;
            publicPath: string;
            sourcePath: string;
            title: string;
          }> | null;
        }
      >;
      identity: FunctionReference<
        "query",
        "public",
        {
          appLocale: "en" | "id" | "de";
          contentKey: string;
          expectedMaterialKey: string;
          expectedSectionKey: string;
        },
        {
          activeReleaseId: string | null;
          managed: boolean;
          publicPath: string | null;
        }
      >;
      latest: FunctionReference<
        "query",
        "public",
        { appLocale: "en" | "id" | "de"; limit: number },
        {
          activeReleaseId: string | null;
          managed: boolean;
          materials: Array<{
            authors: Array<{ name: string }>;
            dateModified?: string;
            datePublished: string;
            description?: string;
            publicPath: string;
            sourcePath: string;
            title: string;
          }>;
        }
      >;
      lesson: FunctionReference<
        "query",
        "public",
        { appLocale: "en" | "id" | "de"; publicPath: string },
        {
          materialKey: string | null;
          model: {
            activeAppLocales: Array<"en" | "id" | "de">;
            activeManifestHash: string | null;
            activeReleaseId: string | null;
            alternateJson: Array<string>;
            projectionJson: string | null;
            rendererDomain:
              | "ai-ds"
              | "biology"
              | "chemistry"
              | "mathematics"
              | "physics"
              | "politics"
              | "site"
              | "snbt-general"
              | "snbt-math"
              | "snbt-plain"
              | "snbt-quant"
              | "tka-math"
              | null;
            sourcePath: string | null;
            sourceRevision: string | null;
          };
          runtimeJson: string | null;
        }
      >;
      navigation: FunctionReference<
        "query",
        "public",
        {
          appLocale: "en" | "id" | "de";
          expectedActiveReleaseId: string;
          materialKey: string;
        },
        {
          activeManifestHash: string | null;
          activeReleaseId: string | null;
          siblingJson: Array<string>;
        }
      >;
      publication: FunctionReference<
        "query",
        "public",
        {
          appLocale: "en" | "id" | "de";
          expectedActiveReleaseId?: string | null;
          publicPath: string;
        },
        {
          activeAppLocales: Array<"en" | "id" | "de">;
          activeManifestHash: string | null;
          activeReleaseId: string | null;
          alternateJson: Array<string>;
          projectionJson: string | null;
          rendererDomain:
            | "ai-ds"
            | "biology"
            | "chemistry"
            | "mathematics"
            | "physics"
            | "politics"
            | "site"
            | "snbt-general"
            | "snbt-math"
            | "snbt-plain"
            | "snbt-quant"
            | "tka-math"
            | null;
          siblingJson: Array<string>;
          sourcePath: string | null;
          sourceRevision: string | null;
        }
      >;
      publications: FunctionReference<
        "query",
        "public",
        {
          appLocale: "en" | "id" | "de";
          expectedManifestHash: string | null;
          expectedReleaseId: string | null;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        {
          activeManifestHash: string | null;
          activeReleaseId: string | null;
          managed: boolean;
          result: {
            continueCursor: string;
            isDone: boolean;
            page: Array<string>;
            pageStatus?: "SplitRecommended" | "SplitRequired" | null;
            splitCursor?: string | null;
          };
          sourceRevision: string | null;
          stale: boolean;
        }
      >;
      sitemapBuckets: FunctionReference<
        "query",
        "public",
        { appLocale: "en" | "id" | "de" },
        {
          activeReleaseId: string | null;
          buckets: Array<string>;
          managed: boolean;
          materialCount: number;
        }
      >;
      sitemapPage: FunctionReference<
        "query",
        "public",
        { appLocale: "en" | "id" | "de"; bucket: Array<string> },
        null | { routes: Array<{ lastModified: string; publicPath: string }> }
      >;
    };
    ownership: {
      resolve: FunctionReference<
        "query",
        "public",
        {
          appLocale: "en" | "id" | "de";
          family: "article" | "material" | "page" | "question";
          publicPath: string;
        },
        | { activeReleaseId: string | null; kind: "unmanaged" }
        | { activeReleaseId: string; kind: "missing" }
        | { activeReleaseId: string; kind: "found"; projectionJson: string }
      >;
    };
    page: {
      catalog: FunctionReference<
        "query",
        "public",
        {},
        {
          activeReleaseId: string | null;
          managed: boolean;
          projectionJson: Array<string>;
        }
      >;
    };
    program: {
      catalog: FunctionReference<
        "query",
        "public",
        { appLocale: "en" | "id" | "de" },
        {
          activeManifestHash: string | null;
          activeReleaseId: string | null;
          managed: boolean;
          programJson: Array<string>;
          routeJson: Array<string>;
          snapshotId: string | null;
          sourceRevision: string | null;
        }
      >;
      context: FunctionReference<
        "query",
        "public",
        {
          appLocale: "en" | "id" | "de";
          contentKey: string;
          expectedActiveReleaseId?: string | null;
          materialKey: string;
          nodeKey: string;
          parentPath: string;
          programKey: string;
          publicPath: string;
        },
        {
          groupJson: string | null;
          managed: boolean;
          mappingJson: string | null;
          parentJson: string | null;
          resolvedCanonicalPath: string | null;
        }
      >;
      page: FunctionReference<
        "query",
        "public",
        {
          appLocale: "en" | "id" | "de";
          expectedManifestHash: string | null;
          expectedReleaseId: string | null;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        {
          activeManifestHash: string | null;
          activeReleaseId: string | null;
          managed: boolean;
          result: {
            continueCursor: string;
            isDone: boolean;
            page: Array<string>;
            pageStatus?: "SplitRecommended" | "SplitRequired" | null;
            splitCursor?: string | null;
          };
          snapshotId: string | null;
          sourceRevision: string | null;
          stale: boolean;
        }
      >;
      path: FunctionReference<
        "query",
        "public",
        { appLocale: "en" | "id" | "de"; publicPath: string },
        { managed: boolean; routeJson: string | null }
      >;
      route: FunctionReference<
        "query",
        "public",
        { appLocale: "en" | "id" | "de"; publicPath: string },
        {
          activeManifestHash: string | null;
          activeReleaseId: string | null;
          alternateJson: Array<string>;
          ancestorJson: Array<string>;
          childJson: Array<string>;
          contextJson: Array<string>;
          groupJson: Array<string>;
          managed: boolean;
          materialJson: Array<string>;
          programJson: string | null;
          routeJson: string | null;
          snapshotId: string | null;
          sourceRevision: string | null;
        }
      >;
      sitemapBuckets: FunctionReference<
        "query",
        "public",
        { appLocale: "en" | "id" | "de" },
        { buckets: Array<string>; managed: boolean; routeCount: number }
      >;
      sitemapPage: FunctionReference<
        "query",
        "public",
        { appLocale: "en" | "id" | "de"; bucket: string },
        null | { routes: Array<{ publicPath: string }> }
      >;
      subjects: FunctionReference<
        "query",
        "public",
        { appLocale: "en" | "id" | "de" },
        { managed: boolean; routeJson: Array<string> }
      >;
    };
    quran: {
      attribution: FunctionReference<
        "query",
        "public",
        {},
        {
          activeManifestHash: string | null;
          activeReleaseId: string | null;
          managed: boolean;
          rowJson: string | null;
          snapshotId: string | null;
          sourceOrigin:
            | { kind: "git"; sha: string }
            | { kind: "rollback"; releaseId: string }
            | null;
          sourceRevision: string | null;
        }
      >;
      page: FunctionReference<
        "query",
        "public",
        { appLocale: "en" | "id" | "de"; surahNumber: number },
        {
          activeManifestHash: string | null;
          activeReleaseId: string | null;
          appLocale: "en" | "id" | "de";
          managed: boolean;
          nextSurah: {
            name: {
              arabic: string;
              sourceMeaning:
                | { de: string; en: string; id: string }
                | { appLocale: "en"; text: string };
              transliteration: string;
            };
            number: number;
            numberOfVerses: number;
          } | null;
          preBismillah: {
            arabic: string;
            translation: {
              notes: Array<{
                number: number;
                referenceOffset: number;
                text: string;
              }>;
              segments: Array<
                | { kind: "text"; offset: number; value: string }
                | { kind: "note"; number: number; offset: number }
              >;
            };
          } | null;
          previousSurah: {
            name: {
              arabic: string;
              sourceMeaning:
                | { de: string; en: string; id: string }
                | { appLocale: "en"; text: string };
              transliteration: string;
            };
            number: number;
            numberOfVerses: number;
          } | null;
          snapshotId: string | null;
          sourceOrigin:
            | { kind: "git"; sha: string }
            | { kind: "rollback"; releaseId: string }
            | null;
          sourceRevision: string | null;
          sources:
            | {
                arabic: {
                  artifact: {
                    byteCount: number;
                    digest: string;
                    fileCount: number;
                  };
                  id: "tanzil-text";
                  kind: "embedded";
                  label: string;
                  notice: string;
                  publisher: string;
                  retrievedAt: string;
                  sourceUrl: string;
                  terms: {
                    artifact: {
                      byteCount: number;
                      digest: string;
                      fileCount: number;
                    };
                    url: string;
                  };
                  updateUrl: string;
                  version: string;
                };
                translation: {
                  artifact: {
                    byteCount: number;
                    digest: string;
                    fileCount: number;
                  };
                  id: "quranenc-english";
                  kind: "embedded";
                  label: string;
                  notice: string;
                  publisher: string;
                  retrievedAt: string;
                  sourceUrl: string;
                  terms: {
                    artifact: {
                      byteCount: number;
                      digest: string;
                      fileCount: number;
                    };
                    url: string;
                  };
                  updateUrl: string;
                  version: string;
                };
              }
            | {
                arabic: {
                  artifact: {
                    byteCount: number;
                    digest: string;
                    fileCount: number;
                  };
                  id: "tanzil-text";
                  kind: "embedded";
                  label: string;
                  notice: string;
                  publisher: string;
                  retrievedAt: string;
                  sourceUrl: string;
                  terms: {
                    artifact: {
                      byteCount: number;
                      digest: string;
                      fileCount: number;
                    };
                    url: string;
                  };
                  updateUrl: string;
                  version: string;
                };
                translation: {
                  artifact: {
                    byteCount: number;
                    digest: string;
                    fileCount: number;
                  };
                  id: "quranenc-indonesian";
                  kind: "embedded";
                  label: string;
                  notice: string;
                  publisher: string;
                  retrievedAt: string;
                  sourceUrl: string;
                  terms: {
                    artifact: {
                      byteCount: number;
                      digest: string;
                      fileCount: number;
                    };
                    url: string;
                  };
                  updateUrl: string;
                  version: string;
                };
              }
            | {
                arabic: {
                  artifact: {
                    byteCount: number;
                    digest: string;
                    fileCount: number;
                  };
                  id: "tanzil-text";
                  kind: "embedded";
                  label: string;
                  notice: string;
                  publisher: string;
                  retrievedAt: string;
                  sourceUrl: string;
                  terms: {
                    artifact: {
                      byteCount: number;
                      digest: string;
                      fileCount: number;
                    };
                    url: string;
                  };
                  updateUrl: string;
                  version: string;
                };
                translation: {
                  artifact: {
                    byteCount: number;
                    digest: string;
                    fileCount: number;
                  };
                  id: "quranenc-german";
                  kind: "embedded";
                  label: string;
                  notice: string;
                  publisher: string;
                  retrievedAt: string;
                  sourceUrl: string;
                  terms: {
                    artifact: {
                      byteCount: number;
                      digest: string;
                      fileCount: number;
                    };
                    url: string;
                  };
                  updateUrl: string;
                  version: string;
                };
              }
            | null;
          surah: {
            name: {
              arabic: string;
              sourceMeaning:
                | { de: string; en: string; id: string }
                | { appLocale: "en"; text: string };
              transliteration: string;
            };
            number: number;
            numberOfVerses: number;
          } | null;
          tafsirAccess:
            | {
                appLocale: "id";
                kind: "embedded";
                notice: string;
                source: {
                  artifact: {
                    byteCount: number;
                    digest: string;
                    fileCount: number;
                  };
                  id: "quranenc-tafsir";
                  kind: "embedded";
                  label: string;
                  notice: string;
                  publisher: string;
                  retrievedAt: string;
                  sourceUrl: string;
                  terms: {
                    artifact: {
                      byteCount: number;
                      digest: string;
                      fileCount: number;
                    };
                    url: string;
                  };
                  updateUrl: string;
                  version: string;
                };
              }
            | {
                appLocale: "en";
                kind: "external";
                notice: string;
                source: {
                  id: "mokhtasar-english";
                  kind: "external";
                  label: string;
                  notice: string;
                  publisher: string;
                  retrievedAt: string;
                  sourceUrl: string;
                  terms: { access: "link-only"; url: string };
                  updateUrl: string;
                  version: string;
                };
              }
            | {
                appLocale: "de";
                kind: "external";
                notice: string;
                source: {
                  id: "mokhtasar-german";
                  kind: "external";
                  label: string;
                  notice: string;
                  publisher: string;
                  retrievedAt: string;
                  sourceUrl: string;
                  terms: { access: "link-only"; url: string };
                  updateUrl: string;
                  version: string;
                };
              }
            | null;
          verses: Array<{
            arabic: string;
            number: { inQuran: number; inSurah: number };
            translation: {
              notes: Array<{
                number: number;
                referenceOffset: number;
                text: string;
              }>;
              segments: Array<
                | { kind: "text"; offset: number; value: string }
                | { kind: "note"; number: number; offset: number }
              >;
            };
          }>;
        }
      >;
      passage: FunctionReference<
        "query",
        "public",
        {
          appLocale: "en" | "id" | "de";
          fromVerse: number;
          surahNumber: number;
          toVerse?: number;
        },
        {
          activeManifestHash: string | null;
          activeReleaseId: string | null;
          chunkJson: Array<string>;
          fromVerse: number;
          managed: boolean;
          preBismillah: {
            arabic: string;
            translation: {
              notes: Array<{
                number: number;
                referenceOffset: number;
                text: string;
              }>;
              segments: Array<
                | { kind: "text"; offset: number; value: string }
                | { kind: "note"; number: number; offset: number }
              >;
            };
          } | null;
          searchJson: string | null;
          snapshotId: string | null;
          sourceOrigin:
            | { kind: "git"; sha: string }
            | { kind: "rollback"; releaseId: string }
            | null;
          sourceRevision: string | null;
          sources:
            | {
                arabic: {
                  artifact: {
                    byteCount: number;
                    digest: string;
                    fileCount: number;
                  };
                  id: "tanzil-text";
                  kind: "embedded";
                  label: string;
                  notice: string;
                  publisher: string;
                  retrievedAt: string;
                  sourceUrl: string;
                  terms: {
                    artifact: {
                      byteCount: number;
                      digest: string;
                      fileCount: number;
                    };
                    url: string;
                  };
                  updateUrl: string;
                  version: string;
                };
                translation: {
                  artifact: {
                    byteCount: number;
                    digest: string;
                    fileCount: number;
                  };
                  id: "quranenc-english";
                  kind: "embedded";
                  label: string;
                  notice: string;
                  publisher: string;
                  retrievedAt: string;
                  sourceUrl: string;
                  terms: {
                    artifact: {
                      byteCount: number;
                      digest: string;
                      fileCount: number;
                    };
                    url: string;
                  };
                  updateUrl: string;
                  version: string;
                };
              }
            | {
                arabic: {
                  artifact: {
                    byteCount: number;
                    digest: string;
                    fileCount: number;
                  };
                  id: "tanzil-text";
                  kind: "embedded";
                  label: string;
                  notice: string;
                  publisher: string;
                  retrievedAt: string;
                  sourceUrl: string;
                  terms: {
                    artifact: {
                      byteCount: number;
                      digest: string;
                      fileCount: number;
                    };
                    url: string;
                  };
                  updateUrl: string;
                  version: string;
                };
                translation: {
                  artifact: {
                    byteCount: number;
                    digest: string;
                    fileCount: number;
                  };
                  id: "quranenc-indonesian";
                  kind: "embedded";
                  label: string;
                  notice: string;
                  publisher: string;
                  retrievedAt: string;
                  sourceUrl: string;
                  terms: {
                    artifact: {
                      byteCount: number;
                      digest: string;
                      fileCount: number;
                    };
                    url: string;
                  };
                  updateUrl: string;
                  version: string;
                };
              }
            | {
                arabic: {
                  artifact: {
                    byteCount: number;
                    digest: string;
                    fileCount: number;
                  };
                  id: "tanzil-text";
                  kind: "embedded";
                  label: string;
                  notice: string;
                  publisher: string;
                  retrievedAt: string;
                  sourceUrl: string;
                  terms: {
                    artifact: {
                      byteCount: number;
                      digest: string;
                      fileCount: number;
                    };
                    url: string;
                  };
                  updateUrl: string;
                  version: string;
                };
                translation: {
                  artifact: {
                    byteCount: number;
                    digest: string;
                    fileCount: number;
                  };
                  id: "quranenc-german";
                  kind: "embedded";
                  label: string;
                  notice: string;
                  publisher: string;
                  retrievedAt: string;
                  sourceUrl: string;
                  terms: {
                    artifact: {
                      byteCount: number;
                      digest: string;
                      fileCount: number;
                    };
                    url: string;
                  };
                  updateUrl: string;
                  version: string;
                };
              }
            | null;
          surahJson: string | null;
          tafsirAccess:
            | {
                appLocale: "id";
                kind: "embedded";
                notice: string;
                source: {
                  artifact: {
                    byteCount: number;
                    digest: string;
                    fileCount: number;
                  };
                  id: "quranenc-tafsir";
                  kind: "embedded";
                  label: string;
                  notice: string;
                  publisher: string;
                  retrievedAt: string;
                  sourceUrl: string;
                  terms: {
                    artifact: {
                      byteCount: number;
                      digest: string;
                      fileCount: number;
                    };
                    url: string;
                  };
                  updateUrl: string;
                  version: string;
                };
              }
            | {
                appLocale: "en";
                kind: "external";
                notice: string;
                source: {
                  id: "mokhtasar-english";
                  kind: "external";
                  label: string;
                  notice: string;
                  publisher: string;
                  retrievedAt: string;
                  sourceUrl: string;
                  terms: { access: "link-only"; url: string };
                  updateUrl: string;
                  version: string;
                };
              }
            | {
                appLocale: "de";
                kind: "external";
                notice: string;
                source: {
                  id: "mokhtasar-german";
                  kind: "external";
                  label: string;
                  notice: string;
                  publisher: string;
                  retrievedAt: string;
                  sourceUrl: string;
                  terms: { access: "link-only"; url: string };
                  updateUrl: string;
                  version: string;
                };
              }
            | null;
          toVerse: number;
        }
      >;
      prose: FunctionReference<
        "query",
        "public",
        {
          appLocale: "en" | "id" | "de";
          surahNumber: number;
          verseLimit?: number;
        },
        {
          activeManifestHash: string | null;
          activeReleaseId: string | null;
          appLocale: "en" | "id" | "de";
          managed: boolean;
          preBismillah: {
            arabic: string;
            translation: {
              notes: Array<{
                number: number;
                referenceOffset: number;
                text: string;
              }>;
              segments: Array<
                | { kind: "text"; offset: number; value: string }
                | { kind: "note"; number: number; offset: number }
              >;
            };
          } | null;
          snapshotId: string | null;
          sourceOrigin:
            | { kind: "git"; sha: string }
            | { kind: "rollback"; releaseId: string }
            | null;
          sourceRevision: string | null;
          sources:
            | {
                arabic: {
                  artifact: {
                    byteCount: number;
                    digest: string;
                    fileCount: number;
                  };
                  id: "tanzil-text";
                  kind: "embedded";
                  label: string;
                  notice: string;
                  publisher: string;
                  retrievedAt: string;
                  sourceUrl: string;
                  terms: {
                    artifact: {
                      byteCount: number;
                      digest: string;
                      fileCount: number;
                    };
                    url: string;
                  };
                  updateUrl: string;
                  version: string;
                };
                translation: {
                  artifact: {
                    byteCount: number;
                    digest: string;
                    fileCount: number;
                  };
                  id: "quranenc-english";
                  kind: "embedded";
                  label: string;
                  notice: string;
                  publisher: string;
                  retrievedAt: string;
                  sourceUrl: string;
                  terms: {
                    artifact: {
                      byteCount: number;
                      digest: string;
                      fileCount: number;
                    };
                    url: string;
                  };
                  updateUrl: string;
                  version: string;
                };
              }
            | {
                arabic: {
                  artifact: {
                    byteCount: number;
                    digest: string;
                    fileCount: number;
                  };
                  id: "tanzil-text";
                  kind: "embedded";
                  label: string;
                  notice: string;
                  publisher: string;
                  retrievedAt: string;
                  sourceUrl: string;
                  terms: {
                    artifact: {
                      byteCount: number;
                      digest: string;
                      fileCount: number;
                    };
                    url: string;
                  };
                  updateUrl: string;
                  version: string;
                };
                translation: {
                  artifact: {
                    byteCount: number;
                    digest: string;
                    fileCount: number;
                  };
                  id: "quranenc-indonesian";
                  kind: "embedded";
                  label: string;
                  notice: string;
                  publisher: string;
                  retrievedAt: string;
                  sourceUrl: string;
                  terms: {
                    artifact: {
                      byteCount: number;
                      digest: string;
                      fileCount: number;
                    };
                    url: string;
                  };
                  updateUrl: string;
                  version: string;
                };
              }
            | {
                arabic: {
                  artifact: {
                    byteCount: number;
                    digest: string;
                    fileCount: number;
                  };
                  id: "tanzil-text";
                  kind: "embedded";
                  label: string;
                  notice: string;
                  publisher: string;
                  retrievedAt: string;
                  sourceUrl: string;
                  terms: {
                    artifact: {
                      byteCount: number;
                      digest: string;
                      fileCount: number;
                    };
                    url: string;
                  };
                  updateUrl: string;
                  version: string;
                };
                translation: {
                  artifact: {
                    byteCount: number;
                    digest: string;
                    fileCount: number;
                  };
                  id: "quranenc-german";
                  kind: "embedded";
                  label: string;
                  notice: string;
                  publisher: string;
                  retrievedAt: string;
                  sourceUrl: string;
                  terms: {
                    artifact: {
                      byteCount: number;
                      digest: string;
                      fileCount: number;
                    };
                    url: string;
                  };
                  updateUrl: string;
                  version: string;
                };
              }
            | null;
          surah: {
            name: {
              arabic: string;
              sourceMeaning:
                | { de: string; en: string; id: string }
                | { appLocale: "en"; text: string };
              transliteration: string;
            };
            number: number;
            numberOfVerses: number;
            revelation: { place: "Meccan" | "Medinan" };
          } | null;
          tafsirAccess:
            | {
                appLocale: "id";
                kind: "embedded";
                notice: string;
                source: {
                  artifact: {
                    byteCount: number;
                    digest: string;
                    fileCount: number;
                  };
                  id: "quranenc-tafsir";
                  kind: "embedded";
                  label: string;
                  notice: string;
                  publisher: string;
                  retrievedAt: string;
                  sourceUrl: string;
                  terms: {
                    artifact: {
                      byteCount: number;
                      digest: string;
                      fileCount: number;
                    };
                    url: string;
                  };
                  updateUrl: string;
                  version: string;
                };
              }
            | {
                appLocale: "en";
                kind: "external";
                notice: string;
                source: {
                  id: "mokhtasar-english";
                  kind: "external";
                  label: string;
                  notice: string;
                  publisher: string;
                  retrievedAt: string;
                  sourceUrl: string;
                  terms: { access: "link-only"; url: string };
                  updateUrl: string;
                  version: string;
                };
              }
            | {
                appLocale: "de";
                kind: "external";
                notice: string;
                source: {
                  id: "mokhtasar-german";
                  kind: "external";
                  label: string;
                  notice: string;
                  publisher: string;
                  retrievedAt: string;
                  sourceUrl: string;
                  terms: { access: "link-only"; url: string };
                  updateUrl: string;
                  version: string;
                };
              }
            | null;
          toVerse: number;
          verses: Array<{
            arabic: string;
            number: { inSurah: number };
            translation: {
              notes: Array<{
                number: number;
                referenceOffset: number;
                text: string;
              }>;
              segments: Array<
                | { kind: "text"; offset: number; value: string }
                | { kind: "note"; number: number; offset: number }
              >;
            };
          }>;
        }
      >;
      surah: FunctionReference<
        "query",
        "public",
        { appLocale: "en" | "id" | "de"; surahNumber: number },
        {
          activeManifestHash: string | null;
          activeReleaseId: string | null;
          appLocale: "en" | "id" | "de";
          managed: boolean;
          preBismillah: {
            arabic: string;
            translation: {
              notes: Array<{
                number: number;
                referenceOffset: number;
                text: string;
              }>;
              segments: Array<
                | { kind: "text"; offset: number; value: string }
                | { kind: "note"; number: number; offset: number }
              >;
            };
          } | null;
          snapshotId: string | null;
          sourceOrigin:
            | { kind: "git"; sha: string }
            | { kind: "rollback"; releaseId: string }
            | null;
          sourceRevision: string | null;
          sources:
            | {
                arabic: {
                  artifact: {
                    byteCount: number;
                    digest: string;
                    fileCount: number;
                  };
                  id: "tanzil-text";
                  kind: "embedded";
                  label: string;
                  notice: string;
                  publisher: string;
                  retrievedAt: string;
                  sourceUrl: string;
                  terms: {
                    artifact: {
                      byteCount: number;
                      digest: string;
                      fileCount: number;
                    };
                    url: string;
                  };
                  updateUrl: string;
                  version: string;
                };
                translation: {
                  artifact: {
                    byteCount: number;
                    digest: string;
                    fileCount: number;
                  };
                  id: "quranenc-english";
                  kind: "embedded";
                  label: string;
                  notice: string;
                  publisher: string;
                  retrievedAt: string;
                  sourceUrl: string;
                  terms: {
                    artifact: {
                      byteCount: number;
                      digest: string;
                      fileCount: number;
                    };
                    url: string;
                  };
                  updateUrl: string;
                  version: string;
                };
              }
            | {
                arabic: {
                  artifact: {
                    byteCount: number;
                    digest: string;
                    fileCount: number;
                  };
                  id: "tanzil-text";
                  kind: "embedded";
                  label: string;
                  notice: string;
                  publisher: string;
                  retrievedAt: string;
                  sourceUrl: string;
                  terms: {
                    artifact: {
                      byteCount: number;
                      digest: string;
                      fileCount: number;
                    };
                    url: string;
                  };
                  updateUrl: string;
                  version: string;
                };
                translation: {
                  artifact: {
                    byteCount: number;
                    digest: string;
                    fileCount: number;
                  };
                  id: "quranenc-indonesian";
                  kind: "embedded";
                  label: string;
                  notice: string;
                  publisher: string;
                  retrievedAt: string;
                  sourceUrl: string;
                  terms: {
                    artifact: {
                      byteCount: number;
                      digest: string;
                      fileCount: number;
                    };
                    url: string;
                  };
                  updateUrl: string;
                  version: string;
                };
              }
            | {
                arabic: {
                  artifact: {
                    byteCount: number;
                    digest: string;
                    fileCount: number;
                  };
                  id: "tanzil-text";
                  kind: "embedded";
                  label: string;
                  notice: string;
                  publisher: string;
                  retrievedAt: string;
                  sourceUrl: string;
                  terms: {
                    artifact: {
                      byteCount: number;
                      digest: string;
                      fileCount: number;
                    };
                    url: string;
                  };
                  updateUrl: string;
                  version: string;
                };
                translation: {
                  artifact: {
                    byteCount: number;
                    digest: string;
                    fileCount: number;
                  };
                  id: "quranenc-german";
                  kind: "embedded";
                  label: string;
                  notice: string;
                  publisher: string;
                  retrievedAt: string;
                  sourceUrl: string;
                  terms: {
                    artifact: {
                      byteCount: number;
                      digest: string;
                      fileCount: number;
                    };
                    url: string;
                  };
                  updateUrl: string;
                  version: string;
                };
              }
            | null;
          surah: {
            kind: "quran-surah";
            name: {
              arabic: string;
              sourceMeaning:
                | { de: string; en: string; id: string }
                | { appLocale: "en"; text: string };
              transliteration: string;
            };
            number: number;
            numberOfVerses: number;
            revelation: { order: number; place: "Meccan" | "Medinan" };
          } | null;
          tafsirAccess:
            | {
                appLocale: "id";
                kind: "embedded";
                notice: string;
                source: {
                  artifact: {
                    byteCount: number;
                    digest: string;
                    fileCount: number;
                  };
                  id: "quranenc-tafsir";
                  kind: "embedded";
                  label: string;
                  notice: string;
                  publisher: string;
                  retrievedAt: string;
                  sourceUrl: string;
                  terms: {
                    artifact: {
                      byteCount: number;
                      digest: string;
                      fileCount: number;
                    };
                    url: string;
                  };
                  updateUrl: string;
                  version: string;
                };
              }
            | {
                appLocale: "en";
                kind: "external";
                notice: string;
                source: {
                  id: "mokhtasar-english";
                  kind: "external";
                  label: string;
                  notice: string;
                  publisher: string;
                  retrievedAt: string;
                  sourceUrl: string;
                  terms: { access: "link-only"; url: string };
                  updateUrl: string;
                  version: string;
                };
              }
            | {
                appLocale: "de";
                kind: "external";
                notice: string;
                source: {
                  id: "mokhtasar-german";
                  kind: "external";
                  label: string;
                  notice: string;
                  publisher: string;
                  retrievedAt: string;
                  sourceUrl: string;
                  terms: { access: "link-only"; url: string };
                  updateUrl: string;
                  version: string;
                };
              }
            | null;
          verses: Array<{
            arabic: string;
            number: { inQuran: number; inSurah: number };
            translation: {
              notes: Array<{
                number: number;
                referenceOffset: number;
                text: string;
              }>;
              segments: Array<
                | { kind: "text"; offset: number; value: string }
                | { kind: "note"; number: number; offset: number }
              >;
            };
          }>;
        }
      >;
      surahs: FunctionReference<
        "query",
        "public",
        {},
        {
          activeManifestHash: string | null;
          activeReleaseId: string | null;
          managed: boolean;
          rowJson: Array<string>;
          snapshotId: string | null;
          sourceOrigin:
            | { kind: "git"; sha: string }
            | { kind: "rollback"; releaseId: string }
            | null;
          sourceRevision: string | null;
        }
      >;
      tafsir: FunctionReference<
        "query",
        "public",
        {
          appLocale: "id";
          expectedSnapshotId: string;
          surahNumber: number;
          verseNumber: number;
        },
        {
          activeManifestHash: string | null;
          activeReleaseId: string | null;
          appLocale: "id";
          interpretation: string | null;
          managed: boolean;
          snapshotId: string | null;
          sourceOrigin:
            | { kind: "git"; sha: string }
            | { kind: "rollback"; releaseId: string }
            | null;
          sourceRevision: string | null;
          surahNumber: number;
          tafsirAccess:
            | {
                appLocale: "id";
                kind: "embedded";
                notice: string;
                source: {
                  artifact: {
                    byteCount: number;
                    digest: string;
                    fileCount: number;
                  };
                  id: "quranenc-tafsir";
                  kind: "embedded";
                  label: string;
                  notice: string;
                  publisher: string;
                  retrievedAt: string;
                  sourceUrl: string;
                  terms: {
                    artifact: {
                      byteCount: number;
                      digest: string;
                      fileCount: number;
                    };
                    url: string;
                  };
                  updateUrl: string;
                  version: string;
                };
              }
            | {
                appLocale: "en";
                kind: "external";
                notice: string;
                source: {
                  id: "mokhtasar-english";
                  kind: "external";
                  label: string;
                  notice: string;
                  publisher: string;
                  retrievedAt: string;
                  sourceUrl: string;
                  terms: { access: "link-only"; url: string };
                  updateUrl: string;
                  version: string;
                };
              }
            | {
                appLocale: "de";
                kind: "external";
                notice: string;
                source: {
                  id: "mokhtasar-german";
                  kind: "external";
                  label: string;
                  notice: string;
                  publisher: string;
                  retrievedAt: string;
                  sourceUrl: string;
                  terms: { access: "link-only"; url: string };
                  updateUrl: string;
                  version: string;
                };
              }
            | null;
          verseNumber: number;
        }
      >;
    };
    reference: {
      read: FunctionReference<
        "query",
        "public",
        {
          input:
            | { contentId: string; kind: "content" }
            | {
                appLocale: "en" | "id" | "de";
                kind: "route";
                publicPath: string;
              };
        },
        {
          alignmentId: string;
          assetId: string;
          conceptId: string;
          content_id: string;
          description: string;
          learningObjectId: string;
          lensId: string;
          locale: "en" | "id" | "de";
          markdown_url?: string;
          route: string;
          section: "articles" | "material" | "tryout" | "quran";
          title: string;
          url: string;
        } | null
      >;
    };
    runtime: {
      active: {
        read: FunctionReference<
          "query",
          "public",
          {},
          null | { manifestHash: string; releaseId: string; sequence: number }
        >;
      };
    };
    tryout: {
      catalog: FunctionReference<
        "query",
        "public",
        { appLocale: "en" | "id" | "de" },
        {
          activeManifestHash: string | null;
          activeReleaseId: string | null;
          rowJson: Array<string>;
          snapshotId: string;
          sourceRevision: string | null;
        }
      >;
      sitemapCount: FunctionReference<
        "query",
        "public",
        { appLocale: "en" | "id" | "de" },
        { pageCount: number; routeCount: number }
      >;
      sitemapPage: FunctionReference<
        "query",
        "public",
        { appLocale: "en" | "id" | "de"; page: number },
        { paths: Array<string> } | null
      >;
      taxonomy: FunctionReference<
        "query",
        "public",
        { appLocale: "en" | "id" | "de" },
        {
          countries: Array<{ id: string; label: string }>;
          exams: Array<{ id: string; label: string }>;
          routeCount: number;
        }
      >;
    };
  };
  contents: {
    mutations: {
      views: {
        recordContentView: FunctionReference<
          "mutation",
          "public",
          {
            contentId: string;
            context?: {
              mode: "placement";
              nodeKey?: string;
              programKey?: string;
            };
            deviceId?: string;
            locale: "en" | "id" | "de";
            publicPath: string;
            section: "articles" | "material";
          },
          { alreadyViewed: boolean; isNewView: boolean; success: boolean }
        >;
      };
    };
    queries: {
      recent: {
        getRecentlyViewed: FunctionReference<
          "query",
          "public",
          { limit?: number; locale: "en" | "id" | "de" },
          Array<{
            alignmentId: string;
            assetId: string;
            conceptId: string;
            content_id: string;
            contextKey: string;
            description: string;
            href: string;
            lastViewedAt: number;
            learningObjectId: string;
            lensId: string;
            locale: "en" | "id" | "de";
            markdown_url?: string;
            materialDomain: string;
            route: string;
            section: "articles" | "material" | "tryout" | "quran";
            title: string;
            url: string;
          }>
        >;
      };
      search: {
        search: FunctionReference<
          "query",
          "public",
          {
            limit: number;
            locale: "en" | "id" | "de";
            offset: number;
            queries?: Array<string>;
            section?: "articles" | "material" | "tryout" | "quran";
          },
          {
            count: number;
            has_more: boolean;
            items: Array<{
              alignmentId: string;
              assetId: string;
              conceptId: string;
              content_id: string;
              description: string;
              excerpt: string;
              learningObjectId: string;
              lensId: string;
              locale: "en" | "id" | "de";
              markdown_url?: string;
              route: string;
              section: "articles" | "material" | "tryout" | "quran";
              title: string;
              url: string;
            }>;
            limit: number;
            next_offset?: number;
            offset: number;
          }
        >;
      };
      trending: {
        getTrendingSubjects: FunctionReference<
          "query",
          "public",
          { locale: "en" | "id" | "de" },
          Array<{
            alignmentId: string;
            assetId: string;
            conceptId: string;
            content_id: string;
            contextKey: string;
            description: string;
            href: string;
            learningObjectId: string;
            lensId: string;
            locale: "en" | "id" | "de";
            markdown_url?: string;
            materialDomain: string;
            route: string;
            section: "articles" | "material" | "tryout" | "quran";
            title: string;
            url: string;
          }>
        >;
      };
    };
  };
  editor: {
    documents: {
      create: FunctionReference<
        "mutation",
        "public",
        {
          content: string;
          scope:
            { kind: "tenant" } | { kind: "unit"; unitId: Id<"tenantUnits"> };
          slug: string;
        },
        { id: Id<"editorDocuments"> }
      >;
      open: FunctionReference<
        "query",
        "public",
        { clientId: string; documentId: Id<"editorDocuments">; slug: string },
        {
          client: { batch: string; version: number } | null;
          snapshot: { content: string; version: number };
          steps: Array<{ clientId: string; step: string; version: number }>;
        }
      >;
    };
    steps: {
      since: FunctionReference<
        "query",
        "public",
        {
          clientId: string;
          documentId: Id<"editorDocuments">;
          slug: string;
          version: number;
        },
        | {
            _tag: "steps";
            client: { batch: string; version: number } | null;
            steps: Array<{ clientId: string; step: string; version: number }>;
          }
        | { _tag: "behind"; client: { batch: string; version: number } | null }
      >;
      submit: FunctionReference<
        "mutation",
        "public",
        { batch: string; documentId: Id<"editorDocuments">; slug: string },
        null
      >;
    };
  };
  exams: {
    assets: {
      canAdd: FunctionReference<
        "query",
        "public",
        { examId: Id<"exams">; slug: string },
        {}
      >;
      register: FunctionReference<
        "action",
        "public",
        {
          examId: Id<"exams">;
          height: number;
          slug: string;
          storageId: Id<"_storage">;
          width: number;
        },
        { id: Id<"examAssets"> }
      >;
      uploadUrl: FunctionReference<
        "mutation",
        "public",
        { examId: Id<"exams">; slug: string },
        string
      >;
      urls: FunctionReference<
        "query",
        "public",
        { assets: Array<Id<"examAssets">>; examId: Id<"exams">; slug: string },
        Array<{ id: Id<"examAssets">; url: string }>
      >;
    };
    exams: {
      cohorts: FunctionReference<
        "query",
        "public",
        { slug: string; unitId: Id<"tenantUnits"> },
        Array<{ id: Id<"tenantCohorts">; name: string }>
      >;
      create: FunctionReference<
        "mutation",
        "public",
        {
          scope:
            { kind: "tenant" } | { kind: "unit"; unitId: Id<"tenantUnits"> };
          slug: string;
          title: string;
        },
        { id: Id<"exams"> }
      >;
      home: FunctionReference<
        "query",
        "public",
        { slug: string },
        {
          canManageSetup: boolean;
          closed: Array<{
            canRelease: boolean;
            closesAt: number;
            cohortId: Id<"tenantCohorts"> | null;
            examId: Id<"exams">;
            examTitle: string;
            id: Id<"examSittings">;
            opensAt: number;
            resultsReleased: boolean;
            room: string;
            state: "scheduled" | "open" | "closed";
            timeZone: string;
            unitId: Id<"tenantUnits">;
          }>;
          drafts: Array<{ createdAt: number; id: Id<"exams">; title: string }>;
          draftsBounded: boolean;
          live: Array<{
            closesAt: number;
            cohortId: Id<"tenantCohorts"> | null;
            examId: Id<"exams">;
            examTitle: string;
            id: Id<"examSittings">;
            opensAt: number;
            room: string;
            state: "scheduled" | "open" | "closed";
            timeZone: string;
            unitId: Id<"tenantUnits">;
          }>;
          next: Array<{
            closesAt: number;
            cohortId: Id<"tenantCohorts"> | null;
            examId: Id<"exams">;
            examTitle: string;
            id: Id<"examSittings">;
            opensAt: number;
            room: string;
            state: "scheduled" | "open" | "closed";
            timeZone: string;
            unitId: Id<"tenantUnits">;
          }>;
          setup?: {
            hasPendingInvite: boolean;
            hasStudent: boolean;
            hasTeacher: boolean;
          };
        }
      >;
      list: FunctionReference<
        "query",
        "public",
        {
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          slug: string;
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{ id: Id<"exams">; title: string }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
      open: FunctionReference<
        "query",
        "public",
        { examId: Id<"exams">; slug: string },
        {
          archived: boolean;
          frozenAt?: number;
          id: Id<"exams">;
          questions: Array<{
            answers: Array<
              | {
                  id: string;
                  kind: "choice";
                  label: string;
                  maxChoices: number;
                  minChoices: number;
                  options: Array<{ id: string; label: any }>;
                  shuffle: boolean;
                }
              | {
                  columns: Array<{ id: string; label: any }>;
                  id: string;
                  kind: "matrix";
                  label: string;
                  shuffle: boolean;
                  statements: Array<{ id: string; label: any }>;
                }
              | {
                  id: string;
                  kind: "match";
                  label: string;
                  shuffle: boolean;
                  sources: Array<{
                    id: string;
                    label: any;
                    maxMatches: number;
                  }>;
                  targets: Array<{
                    id: string;
                    label: any;
                    maxMatches: number;
                  }>;
                }
              | {
                  id: string;
                  items: Array<{ id: string; label: any }>;
                  kind: "order";
                  label: string;
                  maxChoices: number;
                  minChoices: number;
                  shuffle: boolean;
                }
              | {
                  id: string;
                  kind: "inlineChoice";
                  label: string;
                  options: Array<{
                    id: string;
                    label: Array<
                      | {
                          marks?: Array<
                            | {
                                type:
                                  | "bold"
                                  | "italic"
                                  | "underline"
                                  | "code"
                                  | "subscript"
                                  | "superscript";
                              }
                            | { attrs: { href: string }; type: "link" }
                          >;
                          text: string;
                          type: "text";
                        }
                      | { attrs: { latex: string }; type: "mathInline" }
                    >;
                  }>;
                  shuffle: boolean;
                }
              | {
                  expectedLength?: number;
                  id: string;
                  kind: "textEntry";
                  label: string;
                }
              | {
                  acceptsFractions: boolean;
                  id: string;
                  kind: "numericEntry";
                  label: string;
                  unit?: string;
                }
              | { id: string; kind: "mathEntry"; label: string }
              | {
                  areas: Array<
                    | {
                        coords: Array<number | number | number | number>;
                        id: string;
                        label: string;
                        shape: "rect";
                      }
                    | {
                        coords: Array<number | number | number>;
                        id: string;
                        label: string;
                        shape: "circle";
                      }
                    | {
                        coords: Array<number | number | number | number>;
                        id: string;
                        label: string;
                        shape: "ellipse";
                      }
                    | {
                        coords: Array<
                          number | number | number | number | number | number
                        >;
                        id: string;
                        label: string;
                        shape: "poly";
                      }
                    | { id: string; label: string; shape: "default" }
                  >;
                  id: string;
                  image: {
                    alt: string;
                    asset: string;
                    height: number;
                    width: number;
                  };
                  kind: "hotspot";
                  label: string;
                  maxChoices: number;
                  minChoices: number;
                }
              | {
                  choices: Array<{
                    id: string;
                    label: Array<
                      | {
                          marks?: Array<
                            | {
                                type:
                                  | "bold"
                                  | "italic"
                                  | "underline"
                                  | "code"
                                  | "subscript"
                                  | "superscript";
                              }
                            | { attrs: { href: string }; type: "link" }
                          >;
                          text: string;
                          type: "text";
                        }
                      | { attrs: { latex: string }; type: "mathInline" }
                    >;
                    maxMatches: number;
                  }>;
                  gaps: Array<{ id: string }>;
                  id: string;
                  kind: "gapMatch";
                  label: string;
                  shuffle: boolean;
                }
              | {
                  count: number;
                  frame: {
                    kind: "cartesian";
                    x: { max: number; min: number };
                    y: { max: number; min: number };
                  };
                  id: string;
                  kind: "graphPoint";
                  label: string;
                  placing: "points" | "lines";
                  snap?: number;
                }
              | {
                  expectedLines?: number;
                  id: string;
                  kind: "extendedText";
                  label: string;
                }
            >;
            id: Id<"examQuestions">;
            key: Array<
              | { correct: Array<string>; interaction: string; kind: "choice" }
              | {
                  answers: Array<{ column: string; statement: string }>;
                  interaction: string;
                  kind: "matrix";
                }
              | {
                  interaction: string;
                  kind: "match";
                  pairs: Array<{ source: string; target: string }>;
                }
              | { interaction: string; kind: "order"; sequence: Array<string> }
              | { correct: string; interaction: string; kind: "inlineChoice" }
              | {
                  accepted: {
                    acceptedAnswers: Array<string>;
                    collapseWhitespace: boolean;
                    ignoreCase: boolean;
                    kind: "text";
                  };
                  interaction: string;
                  kind: "textEntry";
                }
              | {
                  interaction: string;
                  kind: "numericEntry";
                  tolerance?: { kind: "absolute" | "relative"; value: string };
                  value: string;
                }
              | { expression: string; interaction: string; kind: "mathEntry" }
              | { correct: Array<string>; interaction: string; kind: "hotspot" }
              | {
                  interaction: string;
                  kind: "gapMatch";
                  pairs: Array<{ choice: string; gap: string }>;
                }
              | {
                  interaction: string;
                  kind: "graphPoint";
                  target:
                    | {
                        kind: "points";
                        points: Array<{ x: number; y: number }>;
                      }
                    | {
                        kind: "lines";
                        lines: Array<{
                          through: Array<
                            { x: number; y: number } | { x: number; y: number }
                          >;
                        }>;
                      };
                  tolerance: number;
                }
              | {
                  criteria: Array<{
                    criterion: string;
                    levels: Array<{ descriptor: string; level: string }>;
                  }>;
                  interaction: string;
                  kind: "extendedText";
                }
            > | null;
            prompt: Id<"editorDocuments">;
            revision: number;
            template: "choice";
          }>;
          title: string;
        }
      >;
      rename: FunctionReference<
        "mutation",
        "public",
        { examId: Id<"exams">; slug: string; title: string },
        { id: Id<"exams">; title: string }
      >;
      schedule: FunctionReference<
        "mutation",
        "public",
        {
          closesAt: number;
          examId: Id<"exams">;
          group:
            | { kind: "unit"; unitId: Id<"tenantUnits"> }
            | { cohortId: Id<"tenantCohorts">; kind: "cohort" };
          opensAt: number;
          room: string;
          slug: string;
        },
        { id: Id<"examSittings">; token: string }
      >;
    };
    questions: {
      add: FunctionReference<
        "mutation",
        "public",
        {
          after: Id<"examQuestions"> | null;
          examId: Id<"exams">;
          slug: string;
        },
        {
          answers: Array<
            | {
                id: string;
                kind: "choice";
                label: string;
                maxChoices: number;
                minChoices: number;
                options: Array<{ id: string; label: any }>;
                shuffle: boolean;
              }
            | {
                columns: Array<{ id: string; label: any }>;
                id: string;
                kind: "matrix";
                label: string;
                shuffle: boolean;
                statements: Array<{ id: string; label: any }>;
              }
            | {
                id: string;
                kind: "match";
                label: string;
                shuffle: boolean;
                sources: Array<{ id: string; label: any; maxMatches: number }>;
                targets: Array<{ id: string; label: any; maxMatches: number }>;
              }
            | {
                id: string;
                items: Array<{ id: string; label: any }>;
                kind: "order";
                label: string;
                maxChoices: number;
                minChoices: number;
                shuffle: boolean;
              }
            | {
                id: string;
                kind: "inlineChoice";
                label: string;
                options: Array<{
                  id: string;
                  label: Array<
                    | {
                        marks?: Array<
                          | {
                              type:
                                | "bold"
                                | "italic"
                                | "underline"
                                | "code"
                                | "subscript"
                                | "superscript";
                            }
                          | { attrs: { href: string }; type: "link" }
                        >;
                        text: string;
                        type: "text";
                      }
                    | { attrs: { latex: string }; type: "mathInline" }
                  >;
                }>;
                shuffle: boolean;
              }
            | {
                expectedLength?: number;
                id: string;
                kind: "textEntry";
                label: string;
              }
            | {
                acceptsFractions: boolean;
                id: string;
                kind: "numericEntry";
                label: string;
                unit?: string;
              }
            | { id: string; kind: "mathEntry"; label: string }
            | {
                areas: Array<
                  | {
                      coords: Array<number | number | number | number>;
                      id: string;
                      label: string;
                      shape: "rect";
                    }
                  | {
                      coords: Array<number | number | number>;
                      id: string;
                      label: string;
                      shape: "circle";
                    }
                  | {
                      coords: Array<number | number | number | number>;
                      id: string;
                      label: string;
                      shape: "ellipse";
                    }
                  | {
                      coords: Array<
                        number | number | number | number | number | number
                      >;
                      id: string;
                      label: string;
                      shape: "poly";
                    }
                  | { id: string; label: string; shape: "default" }
                >;
                id: string;
                image: {
                  alt: string;
                  asset: string;
                  height: number;
                  width: number;
                };
                kind: "hotspot";
                label: string;
                maxChoices: number;
                minChoices: number;
              }
            | {
                choices: Array<{
                  id: string;
                  label: Array<
                    | {
                        marks?: Array<
                          | {
                              type:
                                | "bold"
                                | "italic"
                                | "underline"
                                | "code"
                                | "subscript"
                                | "superscript";
                            }
                          | { attrs: { href: string }; type: "link" }
                        >;
                        text: string;
                        type: "text";
                      }
                    | { attrs: { latex: string }; type: "mathInline" }
                  >;
                  maxMatches: number;
                }>;
                gaps: Array<{ id: string }>;
                id: string;
                kind: "gapMatch";
                label: string;
                shuffle: boolean;
              }
            | {
                count: number;
                frame: {
                  kind: "cartesian";
                  x: { max: number; min: number };
                  y: { max: number; min: number };
                };
                id: string;
                kind: "graphPoint";
                label: string;
                placing: "points" | "lines";
                snap?: number;
              }
            | {
                expectedLines?: number;
                id: string;
                kind: "extendedText";
                label: string;
              }
          >;
          id: Id<"examQuestions">;
          key: Array<
            | { correct: Array<string>; interaction: string; kind: "choice" }
            | {
                answers: Array<{ column: string; statement: string }>;
                interaction: string;
                kind: "matrix";
              }
            | {
                interaction: string;
                kind: "match";
                pairs: Array<{ source: string; target: string }>;
              }
            | { interaction: string; kind: "order"; sequence: Array<string> }
            | { correct: string; interaction: string; kind: "inlineChoice" }
            | {
                accepted: {
                  acceptedAnswers: Array<string>;
                  collapseWhitespace: boolean;
                  ignoreCase: boolean;
                  kind: "text";
                };
                interaction: string;
                kind: "textEntry";
              }
            | {
                interaction: string;
                kind: "numericEntry";
                tolerance?: { kind: "absolute" | "relative"; value: string };
                value: string;
              }
            | { expression: string; interaction: string; kind: "mathEntry" }
            | { correct: Array<string>; interaction: string; kind: "hotspot" }
            | {
                interaction: string;
                kind: "gapMatch";
                pairs: Array<{ choice: string; gap: string }>;
              }
            | {
                interaction: string;
                kind: "graphPoint";
                target:
                  | { kind: "points"; points: Array<{ x: number; y: number }> }
                  | {
                      kind: "lines";
                      lines: Array<{
                        through: Array<
                          { x: number; y: number } | { x: number; y: number }
                        >;
                      }>;
                    };
                tolerance: number;
              }
            | {
                criteria: Array<{
                  criterion: string;
                  levels: Array<{ descriptor: string; level: string }>;
                }>;
                interaction: string;
                kind: "extendedText";
              }
          > | null;
          prompt: Id<"editorDocuments">;
          revision: number;
          template: "choice";
        }
      >;
      answer: FunctionReference<
        "mutation",
        "public",
        {
          answers: Array<
            | {
                id: string;
                kind: "choice";
                label: string;
                maxChoices: number;
                minChoices: number;
                options: Array<{ id: string; label: any }>;
                shuffle: boolean;
              }
            | {
                columns: Array<{ id: string; label: any }>;
                id: string;
                kind: "matrix";
                label: string;
                shuffle: boolean;
                statements: Array<{ id: string; label: any }>;
              }
            | {
                id: string;
                kind: "match";
                label: string;
                shuffle: boolean;
                sources: Array<{ id: string; label: any; maxMatches: number }>;
                targets: Array<{ id: string; label: any; maxMatches: number }>;
              }
            | {
                id: string;
                items: Array<{ id: string; label: any }>;
                kind: "order";
                label: string;
                maxChoices: number;
                minChoices: number;
                shuffle: boolean;
              }
            | {
                id: string;
                kind: "inlineChoice";
                label: string;
                options: Array<{
                  id: string;
                  label: Array<
                    | {
                        marks?: Array<
                          | {
                              type:
                                | "bold"
                                | "italic"
                                | "underline"
                                | "code"
                                | "subscript"
                                | "superscript";
                            }
                          | { attrs: { href: string }; type: "link" }
                        >;
                        text: string;
                        type: "text";
                      }
                    | { attrs: { latex: string }; type: "mathInline" }
                  >;
                }>;
                shuffle: boolean;
              }
            | {
                expectedLength?: number;
                id: string;
                kind: "textEntry";
                label: string;
              }
            | {
                acceptsFractions: boolean;
                id: string;
                kind: "numericEntry";
                label: string;
                unit?: string;
              }
            | { id: string; kind: "mathEntry"; label: string }
            | {
                areas: Array<
                  | {
                      coords: Array<number | number | number | number>;
                      id: string;
                      label: string;
                      shape: "rect";
                    }
                  | {
                      coords: Array<number | number | number>;
                      id: string;
                      label: string;
                      shape: "circle";
                    }
                  | {
                      coords: Array<number | number | number | number>;
                      id: string;
                      label: string;
                      shape: "ellipse";
                    }
                  | {
                      coords: Array<
                        number | number | number | number | number | number
                      >;
                      id: string;
                      label: string;
                      shape: "poly";
                    }
                  | { id: string; label: string; shape: "default" }
                >;
                id: string;
                image: {
                  alt: string;
                  asset: string;
                  height: number;
                  width: number;
                };
                kind: "hotspot";
                label: string;
                maxChoices: number;
                minChoices: number;
              }
            | {
                choices: Array<{
                  id: string;
                  label: Array<
                    | {
                        marks?: Array<
                          | {
                              type:
                                | "bold"
                                | "italic"
                                | "underline"
                                | "code"
                                | "subscript"
                                | "superscript";
                            }
                          | { attrs: { href: string }; type: "link" }
                        >;
                        text: string;
                        type: "text";
                      }
                    | { attrs: { latex: string }; type: "mathInline" }
                  >;
                  maxMatches: number;
                }>;
                gaps: Array<{ id: string }>;
                id: string;
                kind: "gapMatch";
                label: string;
                shuffle: boolean;
              }
            | {
                count: number;
                frame: {
                  kind: "cartesian";
                  x: { max: number; min: number };
                  y: { max: number; min: number };
                };
                id: string;
                kind: "graphPoint";
                label: string;
                placing: "points" | "lines";
                snap?: number;
              }
            | {
                expectedLines?: number;
                id: string;
                kind: "extendedText";
                label: string;
              }
          >;
          examId: Id<"exams">;
          key: Array<
            | { correct: Array<string>; interaction: string; kind: "choice" }
            | {
                answers: Array<{ column: string; statement: string }>;
                interaction: string;
                kind: "matrix";
              }
            | {
                interaction: string;
                kind: "match";
                pairs: Array<{ source: string; target: string }>;
              }
            | { interaction: string; kind: "order"; sequence: Array<string> }
            | { correct: string; interaction: string; kind: "inlineChoice" }
            | {
                accepted: {
                  acceptedAnswers: Array<string>;
                  collapseWhitespace: boolean;
                  ignoreCase: boolean;
                  kind: "text";
                };
                interaction: string;
                kind: "textEntry";
              }
            | {
                interaction: string;
                kind: "numericEntry";
                tolerance?: { kind: "absolute" | "relative"; value: string };
                value: string;
              }
            | { expression: string; interaction: string; kind: "mathEntry" }
            | { correct: Array<string>; interaction: string; kind: "hotspot" }
            | {
                interaction: string;
                kind: "gapMatch";
                pairs: Array<{ choice: string; gap: string }>;
              }
            | {
                interaction: string;
                kind: "graphPoint";
                target:
                  | { kind: "points"; points: Array<{ x: number; y: number }> }
                  | {
                      kind: "lines";
                      lines: Array<{
                        through: Array<
                          { x: number; y: number } | { x: number; y: number }
                        >;
                      }>;
                    };
                tolerance: number;
              }
            | {
                criteria: Array<{
                  criterion: string;
                  levels: Array<{ descriptor: string; level: string }>;
                }>;
                interaction: string;
                kind: "extendedText";
              }
          > | null;
          questionId: Id<"examQuestions">;
          revision: number;
          slug: string;
        },
        {
          answers: Array<
            | {
                id: string;
                kind: "choice";
                label: string;
                maxChoices: number;
                minChoices: number;
                options: Array<{ id: string; label: any }>;
                shuffle: boolean;
              }
            | {
                columns: Array<{ id: string; label: any }>;
                id: string;
                kind: "matrix";
                label: string;
                shuffle: boolean;
                statements: Array<{ id: string; label: any }>;
              }
            | {
                id: string;
                kind: "match";
                label: string;
                shuffle: boolean;
                sources: Array<{ id: string; label: any; maxMatches: number }>;
                targets: Array<{ id: string; label: any; maxMatches: number }>;
              }
            | {
                id: string;
                items: Array<{ id: string; label: any }>;
                kind: "order";
                label: string;
                maxChoices: number;
                minChoices: number;
                shuffle: boolean;
              }
            | {
                id: string;
                kind: "inlineChoice";
                label: string;
                options: Array<{
                  id: string;
                  label: Array<
                    | {
                        marks?: Array<
                          | {
                              type:
                                | "bold"
                                | "italic"
                                | "underline"
                                | "code"
                                | "subscript"
                                | "superscript";
                            }
                          | { attrs: { href: string }; type: "link" }
                        >;
                        text: string;
                        type: "text";
                      }
                    | { attrs: { latex: string }; type: "mathInline" }
                  >;
                }>;
                shuffle: boolean;
              }
            | {
                expectedLength?: number;
                id: string;
                kind: "textEntry";
                label: string;
              }
            | {
                acceptsFractions: boolean;
                id: string;
                kind: "numericEntry";
                label: string;
                unit?: string;
              }
            | { id: string; kind: "mathEntry"; label: string }
            | {
                areas: Array<
                  | {
                      coords: Array<number | number | number | number>;
                      id: string;
                      label: string;
                      shape: "rect";
                    }
                  | {
                      coords: Array<number | number | number>;
                      id: string;
                      label: string;
                      shape: "circle";
                    }
                  | {
                      coords: Array<number | number | number | number>;
                      id: string;
                      label: string;
                      shape: "ellipse";
                    }
                  | {
                      coords: Array<
                        number | number | number | number | number | number
                      >;
                      id: string;
                      label: string;
                      shape: "poly";
                    }
                  | { id: string; label: string; shape: "default" }
                >;
                id: string;
                image: {
                  alt: string;
                  asset: string;
                  height: number;
                  width: number;
                };
                kind: "hotspot";
                label: string;
                maxChoices: number;
                minChoices: number;
              }
            | {
                choices: Array<{
                  id: string;
                  label: Array<
                    | {
                        marks?: Array<
                          | {
                              type:
                                | "bold"
                                | "italic"
                                | "underline"
                                | "code"
                                | "subscript"
                                | "superscript";
                            }
                          | { attrs: { href: string }; type: "link" }
                        >;
                        text: string;
                        type: "text";
                      }
                    | { attrs: { latex: string }; type: "mathInline" }
                  >;
                  maxMatches: number;
                }>;
                gaps: Array<{ id: string }>;
                id: string;
                kind: "gapMatch";
                label: string;
                shuffle: boolean;
              }
            | {
                count: number;
                frame: {
                  kind: "cartesian";
                  x: { max: number; min: number };
                  y: { max: number; min: number };
                };
                id: string;
                kind: "graphPoint";
                label: string;
                placing: "points" | "lines";
                snap?: number;
              }
            | {
                expectedLines?: number;
                id: string;
                kind: "extendedText";
                label: string;
              }
          >;
          id: Id<"examQuestions">;
          key: Array<
            | { correct: Array<string>; interaction: string; kind: "choice" }
            | {
                answers: Array<{ column: string; statement: string }>;
                interaction: string;
                kind: "matrix";
              }
            | {
                interaction: string;
                kind: "match";
                pairs: Array<{ source: string; target: string }>;
              }
            | { interaction: string; kind: "order"; sequence: Array<string> }
            | { correct: string; interaction: string; kind: "inlineChoice" }
            | {
                accepted: {
                  acceptedAnswers: Array<string>;
                  collapseWhitespace: boolean;
                  ignoreCase: boolean;
                  kind: "text";
                };
                interaction: string;
                kind: "textEntry";
              }
            | {
                interaction: string;
                kind: "numericEntry";
                tolerance?: { kind: "absolute" | "relative"; value: string };
                value: string;
              }
            | { expression: string; interaction: string; kind: "mathEntry" }
            | { correct: Array<string>; interaction: string; kind: "hotspot" }
            | {
                interaction: string;
                kind: "gapMatch";
                pairs: Array<{ choice: string; gap: string }>;
              }
            | {
                interaction: string;
                kind: "graphPoint";
                target:
                  | { kind: "points"; points: Array<{ x: number; y: number }> }
                  | {
                      kind: "lines";
                      lines: Array<{
                        through: Array<
                          { x: number; y: number } | { x: number; y: number }
                        >;
                      }>;
                    };
                tolerance: number;
              }
            | {
                criteria: Array<{
                  criterion: string;
                  levels: Array<{ descriptor: string; level: string }>;
                }>;
                interaction: string;
                kind: "extendedText";
              }
          > | null;
          prompt: Id<"editorDocuments">;
          revision: number;
          template: "choice";
        }
      >;
      copy: FunctionReference<
        "mutation",
        "public",
        { examId: Id<"exams">; questionId: Id<"examQuestions">; slug: string },
        {
          answers: Array<
            | {
                id: string;
                kind: "choice";
                label: string;
                maxChoices: number;
                minChoices: number;
                options: Array<{ id: string; label: any }>;
                shuffle: boolean;
              }
            | {
                columns: Array<{ id: string; label: any }>;
                id: string;
                kind: "matrix";
                label: string;
                shuffle: boolean;
                statements: Array<{ id: string; label: any }>;
              }
            | {
                id: string;
                kind: "match";
                label: string;
                shuffle: boolean;
                sources: Array<{ id: string; label: any; maxMatches: number }>;
                targets: Array<{ id: string; label: any; maxMatches: number }>;
              }
            | {
                id: string;
                items: Array<{ id: string; label: any }>;
                kind: "order";
                label: string;
                maxChoices: number;
                minChoices: number;
                shuffle: boolean;
              }
            | {
                id: string;
                kind: "inlineChoice";
                label: string;
                options: Array<{
                  id: string;
                  label: Array<
                    | {
                        marks?: Array<
                          | {
                              type:
                                | "bold"
                                | "italic"
                                | "underline"
                                | "code"
                                | "subscript"
                                | "superscript";
                            }
                          | { attrs: { href: string }; type: "link" }
                        >;
                        text: string;
                        type: "text";
                      }
                    | { attrs: { latex: string }; type: "mathInline" }
                  >;
                }>;
                shuffle: boolean;
              }
            | {
                expectedLength?: number;
                id: string;
                kind: "textEntry";
                label: string;
              }
            | {
                acceptsFractions: boolean;
                id: string;
                kind: "numericEntry";
                label: string;
                unit?: string;
              }
            | { id: string; kind: "mathEntry"; label: string }
            | {
                areas: Array<
                  | {
                      coords: Array<number | number | number | number>;
                      id: string;
                      label: string;
                      shape: "rect";
                    }
                  | {
                      coords: Array<number | number | number>;
                      id: string;
                      label: string;
                      shape: "circle";
                    }
                  | {
                      coords: Array<number | number | number | number>;
                      id: string;
                      label: string;
                      shape: "ellipse";
                    }
                  | {
                      coords: Array<
                        number | number | number | number | number | number
                      >;
                      id: string;
                      label: string;
                      shape: "poly";
                    }
                  | { id: string; label: string; shape: "default" }
                >;
                id: string;
                image: {
                  alt: string;
                  asset: string;
                  height: number;
                  width: number;
                };
                kind: "hotspot";
                label: string;
                maxChoices: number;
                minChoices: number;
              }
            | {
                choices: Array<{
                  id: string;
                  label: Array<
                    | {
                        marks?: Array<
                          | {
                              type:
                                | "bold"
                                | "italic"
                                | "underline"
                                | "code"
                                | "subscript"
                                | "superscript";
                            }
                          | { attrs: { href: string }; type: "link" }
                        >;
                        text: string;
                        type: "text";
                      }
                    | { attrs: { latex: string }; type: "mathInline" }
                  >;
                  maxMatches: number;
                }>;
                gaps: Array<{ id: string }>;
                id: string;
                kind: "gapMatch";
                label: string;
                shuffle: boolean;
              }
            | {
                count: number;
                frame: {
                  kind: "cartesian";
                  x: { max: number; min: number };
                  y: { max: number; min: number };
                };
                id: string;
                kind: "graphPoint";
                label: string;
                placing: "points" | "lines";
                snap?: number;
              }
            | {
                expectedLines?: number;
                id: string;
                kind: "extendedText";
                label: string;
              }
          >;
          id: Id<"examQuestions">;
          key: Array<
            | { correct: Array<string>; interaction: string; kind: "choice" }
            | {
                answers: Array<{ column: string; statement: string }>;
                interaction: string;
                kind: "matrix";
              }
            | {
                interaction: string;
                kind: "match";
                pairs: Array<{ source: string; target: string }>;
              }
            | { interaction: string; kind: "order"; sequence: Array<string> }
            | { correct: string; interaction: string; kind: "inlineChoice" }
            | {
                accepted: {
                  acceptedAnswers: Array<string>;
                  collapseWhitespace: boolean;
                  ignoreCase: boolean;
                  kind: "text";
                };
                interaction: string;
                kind: "textEntry";
              }
            | {
                interaction: string;
                kind: "numericEntry";
                tolerance?: { kind: "absolute" | "relative"; value: string };
                value: string;
              }
            | { expression: string; interaction: string; kind: "mathEntry" }
            | { correct: Array<string>; interaction: string; kind: "hotspot" }
            | {
                interaction: string;
                kind: "gapMatch";
                pairs: Array<{ choice: string; gap: string }>;
              }
            | {
                interaction: string;
                kind: "graphPoint";
                target:
                  | { kind: "points"; points: Array<{ x: number; y: number }> }
                  | {
                      kind: "lines";
                      lines: Array<{
                        through: Array<
                          { x: number; y: number } | { x: number; y: number }
                        >;
                      }>;
                    };
                tolerance: number;
              }
            | {
                criteria: Array<{
                  criterion: string;
                  levels: Array<{ descriptor: string; level: string }>;
                }>;
                interaction: string;
                kind: "extendedText";
              }
          > | null;
          prompt: Id<"editorDocuments">;
          revision: number;
          template: "choice";
        }
      >;
      move: FunctionReference<
        "mutation",
        "public",
        {
          examId: Id<"exams">;
          index: number;
          questionId: Id<"examQuestions">;
          slug: string;
        },
        { questions: Array<Id<"examQuestions">> }
      >;
      remove: FunctionReference<
        "mutation",
        "public",
        { examId: Id<"exams">; questionId: Id<"examQuestions">; slug: string },
        { questions: Array<Id<"examQuestions">> }
      >;
    };
    results: {
      results: {
        byQuestion: FunctionReference<
          "query",
          "public",
          {
            paginationOpts: {
              cursor: string | null;
              endCursor?: string | null;
              id?: number;
              maximumBytesRead?: number;
              maximumRowsRead?: number;
              numItems: number;
            };
            questionId: Id<"examQuestions">;
            sittingId: Id<"examSittings">;
            slug: string;
          },
          {
            continueCursor: string;
            isDone: boolean;
            page: Array<{
              attemptId: Id<"examAttempts">;
              name: string;
              response: Array<string>;
              verdict: "correct" | "incorrect" | "pending";
            }>;
            pageStatus?: "SplitRecommended" | "SplitRequired" | null;
            splitCursor?: string | null;
          }
        >;
        byStudent: FunctionReference<
          "query",
          "public",
          {
            paginationOpts: {
              cursor: string | null;
              endCursor?: string | null;
              id?: number;
              maximumBytesRead?: number;
              maximumRowsRead?: number;
              numItems: number;
            };
            sittingId: Id<"examSittings">;
            slug: string;
            state?: "inProgress" | "locked" | "closing" | "submitted";
          },
          {
            continueCursor: string;
            isDone: boolean;
            page: Array<{
              answered: number | null;
              attemptId: Id<"examAttempts">;
              name: string;
              pending: number | null;
              points: number | null;
              state: "inProgress" | "locked" | "closing" | "submitted";
              submittedAt: number | null;
            }>;
            pageStatus?: "SplitRecommended" | "SplitRequired" | null;
            splitCursor?: string | null;
          }
        >;
        mine: FunctionReference<
          "query",
          "public",
          { sittingId: Id<"examSittings">; slug: string },
          {
            points: number;
            questions: Array<{
              number: number;
              optionIds: Array<string>;
              response: Array<string>;
              verdict: "correct" | "incorrect" | "pending";
            }>;
          } | null
        >;
        overview: FunctionReference<
          "query",
          "public",
          { sittingId: Id<"examSittings">; slug: string },
          {
            can: Array<"result.release" | "result.view">;
            questions: Array<{
              id: Id<"examQuestions">;
              number: number;
              optionIds: Array<string>;
            }>;
            releasedAt: number | null;
            sitting: {
              closesAt: number;
              cohortId: Id<"tenantCohorts"> | null;
              examId: Id<"exams">;
              examTitle: string;
              id: Id<"examSittings">;
              opensAt: number;
              room: string;
              state: "scheduled" | "open" | "closed";
              timeZone: string;
              unitId: Id<"tenantUnits">;
            };
          }
        >;
        questionStats: FunctionReference<
          "query",
          "public",
          {
            questionId: Id<"examQuestions">;
            sittingId: Id<"examSittings">;
            slug: string;
          },
          {
            answered: number;
            complete: boolean;
            correct: number;
            counted: number;
            incorrect: number;
            optionCounts: Array<{ count: number; optionId: string }>;
            pending: number;
          }
        >;
        release: FunctionReference<
          "mutation",
          "public",
          { sittingId: Id<"examSittings">; slug: string },
          null
        >;
      };
    };
    rooms: {
      exam: FunctionReference<
        "query",
        "public",
        { examId: Id<"exams">; slug: string },
        { id: Id<"exams">; title: string }
      >;
      list: FunctionReference<
        "query",
        "public",
        {
          examId: Id<"exams">;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          slug: string;
          state?: "scheduled" | "open" | "closed";
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            canCancel: boolean;
            closesAt: number;
            group: { kind: "cohort" | "unit"; name: string };
            id: Id<"examSittings">;
            opensAt: number;
            room: string;
            state: "scheduled" | "open" | "closed";
            timeZone: string;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
    };
    sittings: {
      addMinutes: FunctionReference<
        "mutation",
        "public",
        {
          attemptId: Id<"examAttempts">;
          minutes: number;
          reason:
            | "power-outage"
            | "device-problem"
            | "network-problem"
            | "health"
            | "rule-break"
            | "other";
          sittingId: Id<"examSittings">;
          slug: string;
        },
        null
      >;
      allowDevice: FunctionReference<
        "mutation",
        "public",
        {
          attemptId: Id<"examAttempts">;
          sittingId: Id<"examSittings">;
          slug: string;
        },
        null
      >;
      answer: FunctionReference<
        "mutation",
        "public",
        {
          deviceId: string;
          questionId: Id<"examQuestions">;
          response: Array<string>;
          sittingId: Id<"examSittings">;
          slug: string;
        },
        null
      >;
      attempt: FunctionReference<
        "query",
        "public",
        { sittingId: Id<"examSittings">; slug: string },
        {
          deadline: number;
          id: Id<"examAttempts">;
          startedAt: number;
          state: "inProgress" | "locked" | "closing" | "submitted";
        } | null
      >;
      cancel: FunctionReference<
        "mutation",
        "public",
        { sittingId: Id<"examSittings">; slug: string },
        null
      >;
      changeToken: FunctionReference<
        "mutation",
        "public",
        { sittingId: Id<"examSittings">; slug: string },
        { token: string }
      >;
      close: FunctionReference<
        "mutation",
        "public",
        { sittingId: Id<"examSittings">; slug: string },
        null
      >;
      dashboard: FunctionReference<
        "query",
        "public",
        {
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          sittingId: Id<"examSittings">;
          slug: string;
        },
        {
          attempts: {
            continueCursor: string;
            isDone: boolean;
            page: Array<{
              away: boolean;
              deadline: number;
              id: Id<"examAttempts">;
              lastActiveAt: number;
              latestSignal: {
                at: number;
                kind:
                  | "exit"
                  | "blur"
                  | "fullscreenExit"
                  | "copy"
                  | "paste"
                  | "secondTab"
                  | "disconnect"
                  | "return";
              } | null;
              mascot: string | null;
              name: string;
              state: "inProgress" | "locked" | "closing" | "submitted";
            }>;
          };
          can: Array<"sitting.proctor" | "sitting.view">;
          canViewResults: boolean;
          sitting: {
            closesAt: number;
            cohortId: Id<"tenantCohorts"> | null;
            examId: Id<"exams">;
            examTitle: string;
            id: Id<"examSittings">;
            opensAt: number;
            room: string;
            state: "scheduled" | "open" | "closed";
            timeZone: string;
            unitId: Id<"tenantUnits">;
          };
          token: string | null;
        }
      >;
      enter: FunctionReference<
        "mutation",
        "public",
        {
          deviceId: string;
          sittingId: Id<"examSittings">;
          slug: string;
          token: string;
        },
        | {
            attempt: Id<"examAttempts">;
            deadline: number;
            outcome: "admitted";
            serverNow: number;
            state: "inProgress" | "locked" | "closing" | "submitted";
          }
        | { outcome: "refused"; reason: "TokenRefused" | "TooManyTries" }
      >;
      expected: FunctionReference<
        "query",
        "public",
        {
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          sittingId: Id<"examSittings">;
          slug: string;
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            id: Id<"tenantPeople">;
            mascot: string | null;
            name: string;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
      finish: FunctionReference<
        "mutation",
        "public",
        { deviceId: string; sittingId: Id<"examSittings">; slug: string },
        null
      >;
      images: FunctionReference<
        "query",
        "public",
        {
          assets: Array<Id<"examAssets">>;
          deviceId: string;
          sittingId: Id<"examSittings">;
          slug: string;
        },
        Array<{ id: Id<"examAssets">; url: string }>
      >;
      lastAnswer: FunctionReference<
        "query",
        "public",
        {
          attemptId: Id<"examAttempts">;
          sittingId: Id<"examSittings">;
          slug: string;
        },
        number | null
      >;
      lock: FunctionReference<
        "mutation",
        "public",
        {
          attemptId: Id<"examAttempts">;
          reason:
            | "power-outage"
            | "device-problem"
            | "network-problem"
            | "health"
            | "rule-break"
            | "other";
          sittingId: Id<"examSittings">;
          slug: string;
        },
        null
      >;
      mine: FunctionReference<
        "query",
        "public",
        { slug: string },
        Array<{
          attempt: "inProgress" | "locked" | "closing" | "submitted" | null;
          attemptId: Id<"examAttempts"> | null;
          closesAt: number;
          cohortId: Id<"tenantCohorts"> | null;
          examId: Id<"exams">;
          examTitle: string;
          id: Id<"examSittings">;
          opensAt: number;
          resultsReleased: boolean;
          room: string;
          score: { points: number; total: number } | null;
          state: "scheduled" | "open" | "closed";
          timeZone: string;
          unitId: Id<"tenantUnits">;
        }>
      >;
      paper: FunctionReference<
        "query",
        "public",
        { deviceId: string; sittingId: Id<"examSittings">; slug: string },
        {
          questions: Array<{
            id: Id<"examQuestions">;
            interactions: Array<
              | {
                  id: string;
                  kind: "choice";
                  label: string;
                  maxChoices: number;
                  minChoices: number;
                  options: Array<{ id: string; label: any }>;
                  shuffle: boolean;
                }
              | {
                  columns: Array<{ id: string; label: any }>;
                  id: string;
                  kind: "matrix";
                  label: string;
                  shuffle: boolean;
                  statements: Array<{ id: string; label: any }>;
                }
              | {
                  id: string;
                  kind: "match";
                  label: string;
                  shuffle: boolean;
                  sources: Array<{
                    id: string;
                    label: any;
                    maxMatches: number;
                  }>;
                  targets: Array<{
                    id: string;
                    label: any;
                    maxMatches: number;
                  }>;
                }
              | {
                  id: string;
                  items: Array<{ id: string; label: any }>;
                  kind: "order";
                  label: string;
                  maxChoices: number;
                  minChoices: number;
                  shuffle: boolean;
                }
              | {
                  id: string;
                  kind: "inlineChoice";
                  label: string;
                  options: Array<{
                    id: string;
                    label: Array<
                      | {
                          marks?: Array<
                            | {
                                type:
                                  | "bold"
                                  | "italic"
                                  | "underline"
                                  | "code"
                                  | "subscript"
                                  | "superscript";
                              }
                            | { attrs: { href: string }; type: "link" }
                          >;
                          text: string;
                          type: "text";
                        }
                      | { attrs: { latex: string }; type: "mathInline" }
                    >;
                  }>;
                  shuffle: boolean;
                }
              | {
                  expectedLength?: number;
                  id: string;
                  kind: "textEntry";
                  label: string;
                }
              | {
                  acceptsFractions: boolean;
                  id: string;
                  kind: "numericEntry";
                  label: string;
                  unit?: string;
                }
              | { id: string; kind: "mathEntry"; label: string }
              | {
                  areas: Array<
                    | {
                        coords: Array<number | number | number | number>;
                        id: string;
                        label: string;
                        shape: "rect";
                      }
                    | {
                        coords: Array<number | number | number>;
                        id: string;
                        label: string;
                        shape: "circle";
                      }
                    | {
                        coords: Array<number | number | number | number>;
                        id: string;
                        label: string;
                        shape: "ellipse";
                      }
                    | {
                        coords: Array<
                          number | number | number | number | number | number
                        >;
                        id: string;
                        label: string;
                        shape: "poly";
                      }
                    | { id: string; label: string; shape: "default" }
                  >;
                  id: string;
                  image: {
                    alt: string;
                    asset: string;
                    height: number;
                    width: number;
                  };
                  kind: "hotspot";
                  label: string;
                  maxChoices: number;
                  minChoices: number;
                }
              | {
                  choices: Array<{
                    id: string;
                    label: Array<
                      | {
                          marks?: Array<
                            | {
                                type:
                                  | "bold"
                                  | "italic"
                                  | "underline"
                                  | "code"
                                  | "subscript"
                                  | "superscript";
                              }
                            | { attrs: { href: string }; type: "link" }
                          >;
                          text: string;
                          type: "text";
                        }
                      | { attrs: { latex: string }; type: "mathInline" }
                    >;
                    maxMatches: number;
                  }>;
                  gaps: Array<{ id: string }>;
                  id: string;
                  kind: "gapMatch";
                  label: string;
                  shuffle: boolean;
                }
              | {
                  count: number;
                  frame: {
                    kind: "cartesian";
                    x: { max: number; min: number };
                    y: { max: number; min: number };
                  };
                  id: string;
                  kind: "graphPoint";
                  label: string;
                  placing: "points" | "lines";
                  snap?: number;
                }
              | {
                  expectedLines?: number;
                  id: string;
                  kind: "extendedText";
                  label: string;
                }
            >;
            number: number;
            response: Array<string> | null;
          }>;
        }
      >;
      prompt: FunctionReference<
        "query",
        "public",
        {
          deviceId: string;
          questionId: Id<"examQuestions">;
          sittingId: Id<"examSittings">;
          slug: string;
        },
        { prompt: string }
      >;
      signal: FunctionReference<
        "mutation",
        "public",
        {
          attemptId: Id<"examAttempts">;
          deviceId: string;
          kind:
            | "exit"
            | "blur"
            | "fullscreenExit"
            | "copy"
            | "paste"
            | "secondTab"
            | "disconnect"
            | "return";
          slug: string;
        },
        null
      >;
      signals: FunctionReference<
        "query",
        "public",
        {
          attemptId: Id<"examAttempts">;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          sittingId: Id<"examSittings">;
          slug: string;
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            at: number;
            kind:
              | "exit"
              | "blur"
              | "fullscreenExit"
              | "copy"
              | "paste"
              | "secondTab"
              | "disconnect"
              | "return";
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
      student: FunctionReference<
        "query",
        "public",
        { sittingId: Id<"examSittings">; slug: string },
        {
          attempt: {
            deadline: number;
            id: Id<"examAttempts">;
            startedAt: number;
            state: "inProgress" | "locked" | "closing" | "submitted";
          } | null;
          sitting: {
            closesAt: number;
            cohortId: Id<"tenantCohorts"> | null;
            examId: Id<"exams">;
            examTitle: string;
            id: Id<"examSittings">;
            opensAt: number;
            room: string;
            state: "scheduled" | "open" | "closed";
            timeZone: string;
            unitId: Id<"tenantUnits">;
          };
        }
      >;
      unlock: FunctionReference<
        "mutation",
        "public",
        {
          attemptId: Id<"examAttempts">;
          reason:
            | "power-outage"
            | "device-problem"
            | "network-problem"
            | "health"
            | "rule-break"
            | "other";
          sittingId: Id<"examSittings">;
          slug: string;
        },
        null
      >;
    };
  };
  identity: {
    cards: {
      enroll: FunctionReference<
        "mutation",
        "public",
        { loginName: string; name: string; slug: string },
        {
          code: string;
          expiresAt: number;
          loginName: string;
          personId: Id<"tenantPeople">;
        }
      >;
      issue: FunctionReference<
        "mutation",
        "public",
        { loginName: string; personId: Id<"tenantPeople">; slug: string },
        {
          code: string;
          expiresAt: number;
          loginName: string;
          personId: Id<"tenantPeople">;
        }
      >;
      print: FunctionReference<
        "mutation",
        "public",
        { personId: Id<"tenantPeople">; slug: string },
        null
      >;
      redeem: FunctionReference<
        "mutation",
        "public",
        {
          code: string;
          deviceId: string;
          loginName: string;
          password: string;
          slug: string;
        },
        | { loginName: string; outcome: "redeemed" }
        | {
            outcome: "refused";
            reason:
              | "expired"
              | "invalid"
              | "passwordTooLong"
              | "passwordTooShort"
              | "rateLimited"
              | "used";
          }
      >;
      reissue: FunctionReference<
        "mutation",
        "public",
        { personId: Id<"tenantPeople">; slug: string },
        {
          code: string;
          expiresAt: number;
          loginName: string;
          personId: Id<"tenantPeople">;
        }
      >;
    };
    logins: {
      list: FunctionReference<
        "query",
        "public",
        {
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          slug: string;
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            issuedAt: number;
            loginName: string;
            person: { id: Id<"tenantPeople">; name: string };
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
    };
  };
  integrations: {
    clients: {
      create: FunctionReference<
        "mutation",
        "public",
        {
          actions: Array<
            | "audit.view"
            | "tenant.manage"
            | "tenant.view"
            | "unit.manage"
            | "unit.view"
            | "card.issue"
            | "person.invite"
            | "person.manage"
            | "person.view"
            | "period.manage"
            | "period.view"
            | "cohort.manage"
            | "cohort.view"
            | "promotion.apply"
            | "promotion.approve"
            | "promotion.prepare"
            | "promotion.view"
            | "grant.revoke"
            | "grant.view"
            | "integration.manage"
            | "integration.view"
            | "connection.manage"
            | "connection.view"
            | "class.manage"
            | "class.view"
            | "forum.manage"
            | "forum.read"
            | "grade.release"
            | "grade.view"
            | "visit.end"
            | "document.edit"
            | "document.view"
            | "exam.edit"
            | "exam.rooms"
            | "exam.view"
            | "sitting.proctor"
            | "sitting.view"
            | "result.release"
            | "result.view"
            | "invite.view"
            | "person.manage"
            | "person.view"
            | "period.manage"
            | "period.view"
            | "cohort.manage"
            | "grant.manage"
            | "owner.manage"
            | "grant.manage"
            | "integration.manage"
            | "integration.view"
            | "integration.manage"
            | "connection.view"
            | "class.create"
            | "class.list"
            | "grade.enter"
            | "grade.list"
            | "scheme.manage"
            | "visit.approve"
            | "document.edit"
            | "document.edit"
            | "exam.edit"
            | "exam.rooms"
            | "exam.view"
            | "exam.edit"
            | "exam.rooms"
            | "exam.view"
          >;
          name: string;
          scope:
            { kind: "tenant" } | { kind: "unit"; unitId: Id<"tenantUnits"> };
          slug: string;
        },
        { id: Id<"integrationClients">; secret: string }
      >;
      list: FunctionReference<
        "query",
        "public",
        {
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          slug: string;
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            actions: Array<
              | "audit.view"
              | "tenant.manage"
              | "tenant.view"
              | "unit.manage"
              | "unit.view"
              | "card.issue"
              | "person.invite"
              | "person.manage"
              | "person.view"
              | "period.manage"
              | "period.view"
              | "cohort.manage"
              | "cohort.view"
              | "promotion.apply"
              | "promotion.approve"
              | "promotion.prepare"
              | "promotion.view"
              | "grant.revoke"
              | "grant.view"
              | "integration.manage"
              | "integration.view"
              | "connection.manage"
              | "connection.view"
              | "class.manage"
              | "class.view"
              | "forum.manage"
              | "forum.read"
              | "grade.release"
              | "grade.view"
              | "visit.end"
              | "document.edit"
              | "document.view"
              | "exam.edit"
              | "exam.rooms"
              | "exam.view"
              | "sitting.proctor"
              | "sitting.view"
              | "result.release"
              | "result.view"
              | "invite.view"
              | "person.manage"
              | "person.view"
              | "period.manage"
              | "period.view"
              | "cohort.manage"
              | "grant.manage"
              | "owner.manage"
              | "grant.manage"
              | "integration.manage"
              | "integration.view"
              | "integration.manage"
              | "connection.view"
              | "class.create"
              | "class.list"
              | "grade.enter"
              | "grade.list"
              | "scheme.manage"
              | "visit.approve"
              | "document.edit"
              | "document.edit"
              | "exam.edit"
              | "exam.rooms"
              | "exam.view"
              | "exam.edit"
              | "exam.rooms"
              | "exam.view"
            >;
            createdAt: number;
            id: Id<"integrationClients">;
            name: string;
            revokedAt: number | null;
            rotatedAt: number;
            scope:
              { kind: "tenant" } | { kind: "unit"; unitId: Id<"tenantUnits"> };
            status: "active" | "revoked";
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
      revoke: FunctionReference<
        "mutation",
        "public",
        { clientId: Id<"integrationClients">; slug: string },
        null
      >;
      rotate: FunctionReference<
        "mutation",
        "public",
        { clientId: Id<"integrationClients">; slug: string },
        { id: Id<"integrationClients">; secret: string }
      >;
    };
  };
  journal: {
    audit: {
      actors: FunctionReference<
        "query",
        "public",
        { slug: string },
        Array<{ id: Id<"tenantPeople">; name: string }>
      >;
      list: FunctionReference<
        "query",
        "public",
        {
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          slug: string;
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            actor:
              | { id: Id<"tenantPeople">; kind: "person"; name: string }
              | { kind: "operator" }
              | { kind: "system" };
            at: number;
            change:
              | { type: "class.created" }
              | { type: "class.renamed" }
              | { type: "class.archived" }
              | { teacher: Id<"tenantPeople">; type: "class.teacherAssigned" }
              | { teacher: Id<"tenantPeople">; type: "class.teacherRemoved" }
              | { type: "cohort.created" }
              | { type: "cohort.renamed" }
              | { type: "cohort.archived" }
              | { type: "cohort.restored" }
              | {
                  assignment: "homeroom";
                  person: Id<"tenantPeople">;
                  type: "assignment.created";
                }
              | {
                  assignment: "homeroom";
                  person: Id<"tenantPeople">;
                  type: "assignment.removed";
                }
              | {
                  connection: Id<"connectorConnections">;
                  connector:
                    | "drive"
                    | "forms"
                    | "classroom"
                    | "calendar"
                    | "gmail"
                    | "dapodik";
                  type: "connection.connected";
                }
              | {
                  connection: Id<"connectorConnections">;
                  connector:
                    | "drive"
                    | "forms"
                    | "classroom"
                    | "calendar"
                    | "gmail"
                    | "dapodik";
                  type: "connection.disconnected";
                }
              | {
                  connection: Id<"connectorConnections">;
                  connector:
                    | "drive"
                    | "forms"
                    | "classroom"
                    | "calendar"
                    | "gmail"
                    | "dapodik";
                  type: "connection.reconnect";
                }
              | {
                  classId: Id<"classes">;
                  periodId: Id<"tenantPeriods">;
                  personId: Id<"tenantPeople">;
                  state: "released";
                  type: "grade.released";
                }
              | {
                  client: Id<"integrationClients">;
                  scope:
                    | { kind: "tenant" }
                    | { kind: "unit"; unitId: Id<"tenantUnits"> };
                  type: "integration.created";
                }
              | {
                  client: Id<"integrationClients">;
                  type: "integration.rotated";
                }
              | {
                  client: Id<"integrationClients">;
                  type: "integration.revoked";
                }
              | { type: "period.created" }
              | { type: "period.opened" }
              | { type: "period.archived" }
              | { type: "period.restored" }
              | { type: "period.rename" }
              | { type: "person.created" }
              | {
                  invite: Id<"tenantInvites">;
                  reason?: "break-glass";
                  type: "person.invited";
                }
              | {
                  method: "card" | "invite" | "operator" | "founder";
                  type: "person.claimed";
                }
              | { type: "person.released" }
              | { reason?: "break-glass"; type: "person.removed" }
              | { type: "person.renamed" }
              | { cohort: Id<"tenantCohorts">; type: "person.placed" }
              | {
                  from: Id<"tenantCohorts">;
                  to: Id<"tenantCohorts">;
                  type: "person.moved";
                }
              | { promotion: Id<"tenantPromotions">; type: "person.graduated" }
              | { invite: Id<"tenantInvites">; type: "invite.expired" }
              | { invite: Id<"tenantInvites">; type: "invite.resent" }
              | { invite: Id<"tenantInvites">; type: "invite.revoked" }
              | { card: Id<"loginCards">; type: "card.issued" }
              | { card: Id<"loginCards">; type: "card.reissued" }
              | { card: Id<"loginCards">; type: "card.redeemed" }
              | { card: Id<"loginCards">; type: "card.printed" }
              | {
                  grant: Id<"tenantGrants">;
                  role: {
                    key:
                      | "owner"
                      | "admin"
                      | "principal"
                      | "deputy"
                      | "teacher"
                      | "counselor"
                      | "staff"
                      | "student"
                      | "guardian"
                      | "proctor"
                      | "auditor"
                      | "integration";
                    kind: "builtin";
                  };
                  scope:
                    | { kind: "tenant" }
                    | { kind: "unit"; unitId: Id<"tenantUnits"> };
                  term:
                    | { kind: "standing" }
                    | { expiresAt: number; kind: "temporary" };
                  type: "grant.created";
                }
              | {
                  grant: Id<"tenantGrants">;
                  reason: "revoked" | "expired" | "replaced" | "left";
                  type: "grant.ended";
                }
              | { type: "person.reactivated" }
              | { type: "person.suspended" }
              | { type: "promotion.applied" }
              | { type: "promotion.approved" }
              | { type: "promotion.cancelled" }
              | { type: "promotion.created" }
              | { type: "promotion.opened" }
              | { type: "promotion.planned" }
              | { person: Id<"tenantPeople">; type: "promotion.studentPlanned" }
              | { type: "promotion.submitted" }
              | {
                  reason: "cohorts" | "students" | "homeroom" | "other";
                  type: "promotion.returned";
                }
              | {
                  step: "archive" | "cohorts" | "place" | "homeroom";
                  type: "promotion.undone";
                }
              | { type: "exam.results.released" }
              | { type: "sitting.schedule" }
              | {
                  attempt: Id<"examAttempts">;
                  reason:
                    | "power-outage"
                    | "device-problem"
                    | "network-problem"
                    | "health"
                    | "rule-break"
                    | "other";
                  type: "sitting.lock";
                }
              | {
                  attempt: Id<"examAttempts">;
                  reason:
                    | "power-outage"
                    | "device-problem"
                    | "network-problem"
                    | "health"
                    | "rule-break"
                    | "other";
                  type: "sitting.unlock";
                }
              | {
                  attempt: Id<"examAttempts">;
                  minutes: number;
                  reason:
                    | "power-outage"
                    | "device-problem"
                    | "network-problem"
                    | "health"
                    | "rule-break"
                    | "other";
                  type: "sitting.addMinutes";
                }
              | { type: "sitting.changeToken" }
              | { attempt: Id<"examAttempts">; type: "sitting.allowDevice" }
              | { attempt: Id<"examAttempts">; type: "sitting.finish" }
              | { type: "sitting.close" }
              | { type: "sitting.cancel" }
              | {
                  contract: {
                    contentLicense: string;
                    dpaVersion: string;
                    modules: Array<
                      "classes" | "exams" | "bank" | "grades" | "reports"
                    >;
                    plan: "tenant" | "unit";
                  };
                  type: "tenant.provisioned";
                }
              | { size: "s" | "m" | "l" | "xl"; type: "tenant.founded" }
              | { country: string; currency: string; type: "tenant.locale.set" }
              | { type: "tenant.logo.removed" }
              | { type: "tenant.logo.set" }
              | {
                  key: "emailDomains" | "nina" | "studentThreads";
                  type: "tenant.policy.set";
                }
              | { name: string; type: "tenant.name.set" }
              | { scheme: Id<"gradingSchemes">; type: "scheme.stored" }
              | { type: "tenant.suspended" }
              | { type: "tenant.reactivated" }
              | { type: "unit.created" }
              | {
                  contentLanguage: "en" | "id" | "de";
                  timeZone: string;
                  type: "unit.locale.set";
                }
              | { type: "unit.archived" }
              | { type: "unit.unarchived" }
              | { npsn: string; type: "unit.npsn.set" }
              | {
                  minutes: number;
                  reason: "support" | "onboarding" | "incident";
                  type: "visit.requested";
                }
              | {
                  grant: Id<"tenantGrants">;
                  person: Id<"tenantPeople">;
                  type: "visit.approved";
                }
              | { type: "visit.declined" }
              | { reason: "expired" | "left" | "revoked"; type: "visit.ended" }
              | { type: string };
            id: Id<"journalEntries">;
            subject:
              | { id: Id<"tenants">; kind: "tenant" }
              | { id: Id<"tenantUnits">; kind: "unit" }
              | { id: Id<"tenantPeople">; kind: "person" }
              | { id: Id<"tenantPeriods">; kind: "period" }
              | { id: Id<"tenantCohorts">; kind: "cohort" }
              | { id: Id<"tenantPromotions">; kind: "promotion" }
              | { id: Id<"tenantGrants">; kind: "grant" }
              | { id: Id<"integrationClients">; kind: "integration" }
              | { id: Id<"connectorConnections">; kind: "connection" }
              | { id: Id<"classes">; kind: "class" }
              | { id: Id<"classGrades">; kind: "grade" }
              | { id: Id<"tenantVisits">; kind: "visit" }
              | { id: Id<"editorDocuments">; kind: "document" }
              | { id: Id<"exams">; kind: "exam" }
              | { id: Id<"examSittings">; kind: "sitting" }
              | { id: Id<"examSittings">; kind: "result" }
              | { kind: string };
            subjectName: string | null;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
    };
  };
  learningPreferences: {
    mutations: {
      setPreferredCurriculum: FunctionReference<
        "mutation",
        "public",
        { locale: "en" | "id" | "de"; preferredCurriculumProgramKey: string },
        null | {
          preferredCurriculumProgramKey: string;
          program: {
            countryCode?: string;
            key: string;
            publicSlug: string;
            title: string;
          };
        }
      >;
      setPreferredTryoutCountry: FunctionReference<
        "mutation",
        "public",
        { locale: "en" | "id" | "de"; preferredTryoutCountryKey: string },
        null | {
          country: {
            countryCode: string;
            key: string;
            publicPath: string;
            title: string;
          };
          preferredTryoutCountryKey: string;
        }
      >;
    };
    queries: {
      getCurrent: FunctionReference<
        "query",
        "public",
        { locale: "en" | "id" | "de" },
        null | {
          preferredCurriculumProgramKey: string;
          program: {
            countryCode?: string;
            key: string;
            publicSlug: string;
            title: string;
          };
        }
      >;
      getCurrentTryout: FunctionReference<
        "query",
        "public",
        { locale: "en" | "id" | "de" },
        null | {
          country: {
            countryCode: string;
            key: string;
            publicPath: string;
            title: string;
          };
          preferredTryoutCountryKey: string;
        }
      >;
      listCurriculumPrograms: FunctionReference<
        "query",
        "public",
        { locale: "en" | "id" | "de" },
        Array<{
          countryCode?: string;
          key: string;
          publicSlug: string;
          title: string;
        }>
      >;
    };
  };
  nina: {
    conversation: {
      get: FunctionReference<
        "query",
        "public",
        { chatId: Id<"chats">; shareToken?: string },
        {
          chat: {
            _creationTime: number;
            _id: Id<"chats">;
            activeTurnId?: Id<"ninaTurns">;
            threadId: string;
            title?: string;
            type: "study";
            updatedAt: number;
            userId?: Id<"users">;
            visibility: "private" | "public";
          };
          turn: {
            credits?: number;
            order: number;
            promptMessageId: string;
            promptedAt?: number;
            remembered?: number;
            state:
              | { status: "queued" }
              | { startedAt: number; status: "running" }
              | { finishedAt: number; status: "complete" }
              | {
                  finishedAt: number;
                  reason?:
                    | "provider-busy"
                    | "provider-unavailable"
                    | "service-configuration"
                    | "request-rejected"
                    | "input-too-large"
                    | "response-timeout"
                    | "content-blocked"
                    | "response-limit"
                    | "interrupted"
                    | "unknown";
                  status: "failed";
                }
              | { finishedAt: number; status: "cancelled" };
            suggestions?: Array<string>;
            tokens?: { input?: number; output?: number; total?: number };
            usage: Array<{
              agent:
                | "nina"
                | "nakafa"
                | "research"
                | "math"
                | "math-repair"
                | "suggestions"
                | "title"
                | "nina-repair"
                | "memory";
              cached?: number;
              calls: number;
              cost?: number;
              input: number;
              model: string;
              output: number;
              provider: string;
              reasoning?: number;
            }>;
          } | null;
        }
      >;
      turns: FunctionReference<
        "query",
        "public",
        {
          chatId: Id<"chats">;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          shareToken?: string;
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            credits?: number;
            order: number;
            promptMessageId: string;
            promptedAt?: number;
            remembered?: number;
            state:
              | { status: "queued" }
              | { startedAt: number; status: "running" }
              | { finishedAt: number; status: "complete" }
              | {
                  finishedAt: number;
                  reason?:
                    | "provider-busy"
                    | "provider-unavailable"
                    | "service-configuration"
                    | "request-rejected"
                    | "input-too-large"
                    | "response-timeout"
                    | "content-blocked"
                    | "response-limit"
                    | "interrupted"
                    | "unknown";
                  status: "failed";
                }
              | { finishedAt: number; status: "cancelled" };
            suggestions?: Array<string>;
            tokens?: { input?: number; output?: number; total?: number };
            usage: Array<{
              agent:
                | "nina"
                | "nakafa"
                | "research"
                | "math"
                | "math-repair"
                | "suggestions"
                | "title"
                | "nina-repair"
                | "memory";
              cached?: number;
              calls: number;
              cost?: number;
              input: number;
              model: string;
              output: number;
              provider: string;
              reasoning?: number;
            }>;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
    };
    lifecycle: {
      cancel: FunctionReference<
        "mutation",
        "public",
        { chatId: Id<"chats"> },
        null
      >;
    };
    memory: {
      add: FunctionReference<
        "mutation",
        "public",
        { text: string; title?: string },
        Id<"ninaMemories">
      >;
      clear: FunctionReference<"mutation", "public", {}, null>;
      edit: FunctionReference<
        "mutation",
        "public",
        { id: Id<"ninaMemories">; text: string; title?: string },
        null
      >;
      list: FunctionReference<
        "query",
        "public",
        {
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            author: "nina" | "learner";
            confirmedAt: number;
            createdAt: number;
            id: Id<"ninaMemories">;
            text: string;
            title?: string;
            validUntil?: number;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
      pause: FunctionReference<"mutation", "public", { paused: boolean }, null>;
      remove: FunctionReference<
        "mutation",
        "public",
        { id: Id<"ninaMemories"> },
        null
      >;
      restore: FunctionReference<
        "mutation",
        "public",
        { id: Id<"ninaMemories"> },
        {
          author: "nina" | "learner";
          confirmedAt: number;
          createdAt: number;
          id: Id<"ninaMemories">;
          text: string;
          title?: string;
          validUntil?: number;
        }
      >;
      state: FunctionReference<
        "query",
        "public",
        {},
        { paused: boolean } | null
      >;
    };
    messages: {
      page: FunctionReference<
        "query",
        "public",
        {
          chatId: Id<"chats">;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          shareToken?: string;
          streamArgs?:
            | { kind: "list"; startOrder?: number }
            | {
                cursors: Array<{ cursor: number; streamId: string }>;
                kind: "deltas";
              };
          threadId: string;
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            _creationTime: number;
            agentName?: string;
            id: string;
            key: string;
            order: number;
            parts: Array<any>;
            role: "user" | "assistant" | "system";
            status: "streaming" | "pending" | "success" | "failed";
            stepOrder: number;
            text: string;
            userId?: string;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
          streams:
            | {
                kind: "list";
                messages: Array<{
                  agentName?: string;
                  format?: "UIMessageChunk" | "TextStreamPart";
                  model?: string;
                  order: number;
                  provider?: string;
                  providerOptions?: Record<string, Record<string, any>>;
                  status: "streaming" | "finished" | "aborted";
                  stepOrder: number;
                  streamId: string;
                  userId?: string;
                }>;
              }
            | {
                deltas: Array<{
                  end: number;
                  parts: Array<any>;
                  start: number;
                  streamId: string;
                }>;
                kind: "deltas";
              };
        }
      >;
    };
    turns: {
      start: FunctionReference<
        "mutation",
        "public",
        {
          chatId?: Id<"chats">;
          input:
            | {
                kind: "message";
                page: {
                  focus?: {
                    attemptId: Id<"tryoutAttempts">;
                    kind: "tryout-question";
                    placementId: Id<"tryoutAttemptPlacements">;
                  };
                  locale: "en" | "id" | "de";
                  materialContextHint?: string;
                  slug: string;
                };
                prompt: { text: string; uploadIds?: Array<Id<"ninaUploads">> };
              }
            | {
                kind: "retry";
                order: number;
                page?: {
                  focus?: {
                    attemptId: Id<"tryoutAttempts">;
                    kind: "tryout-question";
                    placementId: Id<"tryoutAttemptPlacements">;
                  };
                  locale: "en" | "id" | "de";
                  materialContextHint?: string;
                  slug: string;
                };
              };
          requestId: string;
        },
        {
          chatId: Id<"chats">;
          order: number;
          prompt: {
            files: Array<{
              filename?: string;
              mediaType: string;
              type: "file";
              url: string;
            }>;
            text: string;
          };
          promptMessageId: string;
          threadId: string;
          turnId: Id<"ninaTurns">;
        }
      >;
    };
    uploads: {
      release: FunctionReference<
        "mutation",
        "public",
        { uploadId: Id<"ninaUploads"> },
        null
      >;
      save: FunctionReference<
        "action",
        "public",
        {
          bytes: ArrayBuffer;
          filename: string;
          mediaType:
            | "image/jpeg"
            | "image/png"
            | "image/webp"
            | "image/gif"
            | "application/pdf"
            | "text/plain";
        },
        Id<"ninaUploads">
      >;
    };
  };
  notifications: {
    inbox: {
      list: FunctionReference<
        "query",
        "public",
        {
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            changeType: "person.invited";
            createdAt: number;
            id: Id<"notifications">;
            readAt?: number;
            subject:
              | { id: Id<"tenants">; kind: "tenant" }
              | { id: Id<"tenantUnits">; kind: "unit" }
              | { id: Id<"tenantPeople">; kind: "person" }
              | { id: Id<"tenantPeriods">; kind: "period" }
              | { id: Id<"tenantCohorts">; kind: "cohort" }
              | { id: Id<"tenantPromotions">; kind: "promotion" }
              | { id: Id<"tenantGrants">; kind: "grant" }
              | { id: Id<"integrationClients">; kind: "integration" }
              | { id: Id<"connectorConnections">; kind: "connection" }
              | { id: Id<"classes">; kind: "class" }
              | { id: Id<"classGrades">; kind: "grade" }
              | { id: Id<"tenantVisits">; kind: "visit" }
              | { id: Id<"editorDocuments">; kind: "document" }
              | { id: Id<"exams">; kind: "exam" }
              | { id: Id<"examSittings">; kind: "sitting" }
              | { id: Id<"examSittings">; kind: "result" }
              | { kind: string };
            tenant: {
              kind: "school" | "foundation";
              logo?: string;
              mascot: string;
              name: string;
              slug: string;
              status: "active" | "suspended";
            };
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
      read: FunctionReference<
        "mutation",
        "public",
        { notificationId: Id<"notifications"> },
        {
          changeType: "person.invited";
          createdAt: number;
          id: Id<"notifications">;
          readAt?: number;
          subject:
            | { id: Id<"tenants">; kind: "tenant" }
            | { id: Id<"tenantUnits">; kind: "unit" }
            | { id: Id<"tenantPeople">; kind: "person" }
            | { id: Id<"tenantPeriods">; kind: "period" }
            | { id: Id<"tenantCohorts">; kind: "cohort" }
            | { id: Id<"tenantPromotions">; kind: "promotion" }
            | { id: Id<"tenantGrants">; kind: "grant" }
            | { id: Id<"integrationClients">; kind: "integration" }
            | { id: Id<"connectorConnections">; kind: "connection" }
            | { id: Id<"classes">; kind: "class" }
            | { id: Id<"classGrades">; kind: "grade" }
            | { id: Id<"tenantVisits">; kind: "visit" }
            | { id: Id<"editorDocuments">; kind: "document" }
            | { id: Id<"exams">; kind: "exam" }
            | { id: Id<"examSittings">; kind: "sitting" }
            | { id: Id<"examSittings">; kind: "result" }
            | { kind: string };
          tenant: {
            kind: "school" | "foundation";
            logo?: string;
            mascot: string;
            name: string;
            slug: string;
            status: "active" | "suspended";
          };
        }
      >;
      readAll: FunctionReference<"mutation", "public", {}, null>;
    };
  };
  onboarding: {
    mutations: {
      admit: FunctionReference<
        "mutation",
        "public",
        {},
        | { isAuthenticated: false; isRequired: false; profile: null }
        | {
            isAuthenticated: true;
            isRequired: boolean;
            profile: null | {
              completedAt?: number;
              focus?: "learning" | "tryout";
              region?:
                | "indonesia"
                | "singapore"
                | "united-kingdom"
                | "germany"
                | "united-states"
                | "international";
              role?: "teacher" | "student" | "parent";
              updatedAt: number;
            };
          }
      >;
      finish: FunctionReference<
        "mutation",
        "public",
        {
          answers: {
            focus: "learning" | "tryout";
            region:
              | "indonesia"
              | "singapore"
              | "united-kingdom"
              | "germany"
              | "united-states"
              | "international";
            role: "teacher" | "student" | "parent";
          };
        },
        {
          destination:
            | { kind: "curriculum-program"; publicSlug: string }
            | { kind: "tryout" };
          locale: "en" | "id" | "de";
        }
      >;
      saveAnswer: FunctionReference<
        "mutation",
        "public",
        {
          answer:
            | { kind: "role"; value: "teacher" | "student" | "parent" }
            | {
                kind: "region";
                value:
                  | "indonesia"
                  | "singapore"
                  | "united-kingdom"
                  | "germany"
                  | "united-states"
                  | "international";
              }
            | { kind: "focus"; value: "learning" | "tryout" };
        },
        {
          completedAt?: number;
          focus?: "learning" | "tryout";
          region?:
            | "indonesia"
            | "singapore"
            | "united-kingdom"
            | "germany"
            | "united-states"
            | "international";
          role?: "teacher" | "student" | "parent";
          updatedAt: number;
        }
      >;
    };
    queries: {
      getStatus: FunctionReference<
        "query",
        "public",
        {},
        | { isAuthenticated: false; isRequired: false; profile: null }
        | {
            isAuthenticated: true;
            isRequired: boolean;
            profile: null | {
              completedAt?: number;
              focus?: "learning" | "tryout";
              region?:
                | "indonesia"
                | "singapore"
                | "united-kingdom"
                | "germany"
                | "united-states"
                | "international";
              role?: "teacher" | "student" | "parent";
              updatedAt: number;
            };
          }
      >;
    };
  };
  operators: {
    tenants: {
      list: FunctionReference<
        "query",
        "public",
        {
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            id: Id<"tenants">;
            kind: "school" | "foundation";
            name: string;
            slug: string;
            status: "active" | "suspended";
            unitCount: number;
            visit: {
              id: Id<"tenantVisits">;
              minutes: number;
              note: string;
              reason: "support" | "onboarding" | "incident";
              requestedAt: number;
              state:
                | { status: "pending" }
                | { at: number; status: "declined" }
                | { at: number; expiresAt: number; status: "approved" }
                | {
                    at: number;
                    reason: "expired" | "left" | "revoked";
                    status: "ended";
                  };
            } | null;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
      open: FunctionReference<
        "mutation",
        "public",
        {
          contract: {
            contentLicense: string;
            dpaVersion: string;
            modules: Array<"classes" | "exams" | "bank" | "grades" | "reports">;
            plan: "tenant" | "unit";
          };
          country: string;
          currency: string;
          kind: "school" | "foundation";
          name: string;
          owner: { email: string; name: string };
          slug: string;
          units: Array<{
            contentLanguage: "en" | "id" | "de";
            level:
              | "paud"
              | "sd"
              | "mi"
              | "smp"
              | "mts"
              | "sma"
              | "ma"
              | "smk"
              | "slb"
              | "other";
            name: string;
            npsn?: string;
            timeZone: string;
          }>;
        },
        {
          invite: Id<"tenantInvites">;
          owner: Id<"tenantPeople">;
          tenant: Id<"tenants">;
          units: Array<Id<"tenantUnits">>;
        }
      >;
      reactivate: FunctionReference<
        "mutation",
        "public",
        { tenantId: Id<"tenants"> },
        {
          id: Id<"tenants">;
          kind: "school" | "foundation";
          name: string;
          slug: string;
          status: "active" | "suspended";
          unitCount: number;
          visit: {
            id: Id<"tenantVisits">;
            minutes: number;
            note: string;
            reason: "support" | "onboarding" | "incident";
            requestedAt: number;
            state:
              | { status: "pending" }
              | { at: number; status: "declined" }
              | { at: number; expiresAt: number; status: "approved" }
              | {
                  at: number;
                  reason: "expired" | "left" | "revoked";
                  status: "ended";
                };
          } | null;
        }
      >;
      replaceOwner: FunctionReference<
        "mutation",
        "public",
        {
          locale: "en" | "id" | "de";
          owner: { email: string; name: string };
          tenantId: Id<"tenants">;
        },
        {
          id: Id<"tenants">;
          kind: "school" | "foundation";
          name: string;
          slug: string;
          status: "active" | "suspended";
          unitCount: number;
          visit: {
            id: Id<"tenantVisits">;
            minutes: number;
            note: string;
            reason: "support" | "onboarding" | "incident";
            requestedAt: number;
            state:
              | { status: "pending" }
              | { at: number; status: "declined" }
              | { at: number; expiresAt: number; status: "approved" }
              | {
                  at: number;
                  reason: "expired" | "left" | "revoked";
                  status: "ended";
                };
          } | null;
        }
      >;
      suspend: FunctionReference<
        "mutation",
        "public",
        { tenantId: Id<"tenants"> },
        {
          id: Id<"tenants">;
          kind: "school" | "foundation";
          name: string;
          slug: string;
          status: "active" | "suspended";
          unitCount: number;
          visit: {
            id: Id<"tenantVisits">;
            minutes: number;
            note: string;
            reason: "support" | "onboarding" | "incident";
            requestedAt: number;
            state:
              | { status: "pending" }
              | { at: number; status: "declined" }
              | { at: number; expiresAt: number; status: "approved" }
              | {
                  at: number;
                  reason: "expired" | "left" | "revoked";
                  status: "ended";
                };
          } | null;
        }
      >;
    };
    visits: {
      approve: FunctionReference<
        "mutation",
        "public",
        { slug: string; visitId: Id<"tenantVisits"> },
        {
          id: Id<"tenantVisits">;
          minutes: number;
          note: string;
          reason: "support" | "onboarding" | "incident";
          requestedAt: number;
          state:
            | { status: "pending" }
            | { at: number; status: "declined" }
            | { at: number; expiresAt: number; status: "approved" }
            | {
                at: number;
                reason: "expired" | "left" | "revoked";
                status: "ended";
              };
        }
      >;
      decline: FunctionReference<
        "mutation",
        "public",
        { slug: string; visitId: Id<"tenantVisits"> },
        {
          id: Id<"tenantVisits">;
          minutes: number;
          note: string;
          reason: "support" | "onboarding" | "incident";
          requestedAt: number;
          state:
            | { status: "pending" }
            | { at: number; status: "declined" }
            | { at: number; expiresAt: number; status: "approved" }
            | {
                at: number;
                reason: "expired" | "left" | "revoked";
                status: "ended";
              };
        }
      >;
      end: FunctionReference<
        "mutation",
        "public",
        { slug: string; visitId: Id<"tenantVisits"> },
        {
          id: Id<"tenantVisits">;
          minutes: number;
          note: string;
          reason: "support" | "onboarding" | "incident";
          requestedAt: number;
          state:
            | { status: "pending" }
            | { at: number; status: "declined" }
            | { at: number; expiresAt: number; status: "approved" }
            | {
                at: number;
                reason: "expired" | "left" | "revoked";
                status: "ended";
              };
        }
      >;
      list: FunctionReference<
        "query",
        "public",
        {
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          slug: string;
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            id: Id<"tenantVisits">;
            minutes: number;
            note: string;
            reason: "support" | "onboarding" | "incident";
            requestedAt: number;
            state:
              | { status: "pending" }
              | { at: number; status: "declined" }
              | { at: number; expiresAt: number; status: "approved" }
              | {
                  at: number;
                  reason: "expired" | "left" | "revoked";
                  status: "ended";
                };
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
      request: FunctionReference<
        "mutation",
        "public",
        {
          minutes: number;
          note: string;
          reason: "support" | "onboarding" | "incident";
          tenantId: Id<"tenants">;
        },
        {
          id: Id<"tenantVisits">;
          minutes: number;
          note: string;
          reason: "support" | "onboarding" | "incident";
          requestedAt: number;
          state:
            | { status: "pending" }
            | { at: number; status: "declined" }
            | { at: number; expiresAt: number; status: "approved" }
            | {
                at: number;
                reason: "expired" | "left" | "revoked";
                status: "ended";
              };
        }
      >;
    };
  };
  posts: {
    mutations: {
      create: FunctionReference<
        "mutation",
        "public",
        { text: string },
        Id<"posts">
      >;
      like: FunctionReference<
        "mutation",
        "public",
        { postId: Id<"posts"> },
        null
      >;
      remove: FunctionReference<
        "mutation",
        "public",
        { postId: Id<"posts"> },
        null
      >;
      unlike: FunctionReference<
        "mutation",
        "public",
        { postId: Id<"posts"> },
        null
      >;
    };
    queries: {
      list: FunctionReference<
        "query",
        "public",
        {
          authorId: Id<"users">;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            _creationTime: number;
            _id: Id<"posts">;
            likeCount: number;
            liked: boolean;
            text: string;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
    };
  };
  records: {
    grades: {
      enter: FunctionReference<
        "mutation",
        "public",
        {
          classId: Id<"classes">;
          personId: Id<"tenantPeople">;
          slug: string;
          value: number;
        },
        {
          band?: string;
          classId: Id<"classes">;
          id: Id<"classGrades">;
          kktp: "reached" | "notReached";
          personId: Id<"tenantPeople">;
          state: "draft" | "released";
          value: number;
        }
      >;
      list: FunctionReference<
        "query",
        "public",
        {
          classId: Id<"classes">;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          slug: string;
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            band?: string;
            classId: Id<"classes">;
            id: Id<"classGrades">;
            kktp: "reached" | "notReached";
            personId: Id<"tenantPeople">;
            state: "draft" | "released";
            value: number;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
      mine: FunctionReference<
        "query",
        "public",
        { classId: Id<"classes">; slug: string },
        Array<{
          band?: string;
          classId: Id<"classes">;
          id: Id<"classGrades">;
          kktp: "reached" | "notReached";
          personId: Id<"tenantPeople">;
          state: "draft" | "released";
          value: number;
        }>
      >;
      release: FunctionReference<
        "mutation",
        "public",
        { gradeId: Id<"classGrades">; slug: string },
        {
          band?: string;
          classId: Id<"classes">;
          id: Id<"classGrades">;
          kktp: "reached" | "notReached";
          personId: Id<"tenantPeople">;
          state: "draft" | "released";
          value: number;
        }
      >;
    };
    schemes: {
      store: FunctionReference<
        "mutation",
        "public",
        {
          bands: Array<{ label: string; minimum: number }>;
          effectiveFrom: number;
          kktp: number;
          slug: string;
        },
        {
          bands: Array<{ label: string; minimum: number }>;
          effectiveFrom: number;
          id: Id<"gradingSchemes">;
          kktp: number;
        }
      >;
    };
  };
  tenancy: {
    assignments: {
      assign: FunctionReference<
        "mutation",
        "public",
        {
          cohortId: Id<"tenantCohorts">;
          personId: Id<"tenantPeople">;
          slug: string;
        },
        {
          cohortId: Id<"tenantCohorts">;
          id: Id<"tenantAssignments">;
          kind: "homeroom";
          personId: Id<"tenantPeople">;
        }
      >;
      unassign: FunctionReference<
        "mutation",
        "public",
        { cohortId: Id<"tenantCohorts">; slug: string },
        {
          cohortId: Id<"tenantCohorts">;
          id: Id<"tenantAssignments">;
          kind: "homeroom";
          personId: Id<"tenantPeople">;
        } | null
      >;
    };
    cohorts: {
      activePeriod: FunctionReference<
        "query",
        "public",
        { slug: string; unitId: Id<"tenantUnits"> },
        Id<"tenantPeriods"> | null
      >;
      archive: FunctionReference<
        "mutation",
        "public",
        { cohortId: Id<"tenantCohorts">; slug: string },
        {
          grade: number;
          id: Id<"tenantCohorts">;
          name: string;
          status: "active" | "archived";
        }
      >;
      create: FunctionReference<
        "mutation",
        "public",
        {
          grade: number;
          name: string;
          periodId: Id<"tenantPeriods">;
          slug: string;
        },
        {
          grade: number;
          id: Id<"tenantCohorts">;
          name: string;
          status: "active" | "archived";
        }
      >;
      get: FunctionReference<
        "query",
        "public",
        { cohortId: Id<"tenantCohorts">; slug: string },
        {
          grade: number;
          homeroom: { id: Id<"tenantPeople">; name: string } | null;
          id: Id<"tenantCohorts">;
          name: string;
          periodId: Id<"tenantPeriods">;
          status: "active" | "archived";
        }
      >;
      list: FunctionReference<
        "query",
        "public",
        { periodId: Id<"tenantPeriods">; slug: string },
        Array<{
          grade: number;
          id: Id<"tenantCohorts">;
          name: string;
          status: "active" | "archived";
        }>
      >;
      members: FunctionReference<
        "query",
        "public",
        {
          cohortId: Id<"tenantCohorts">;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          slug: string;
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{ id: Id<"tenantPeople">; name: string }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
      rename: FunctionReference<
        "mutation",
        "public",
        { cohortId: Id<"tenantCohorts">; name: string; slug: string },
        {
          grade: number;
          id: Id<"tenantCohorts">;
          name: string;
          status: "active" | "archived";
        }
      >;
      restore: FunctionReference<
        "mutation",
        "public",
        { cohortId: Id<"tenantCohorts">; slug: string },
        {
          grade: number;
          id: Id<"tenantCohorts">;
          name: string;
          status: "active" | "archived";
        }
      >;
    };
    home: {
      setup: FunctionReference<
        "query",
        "public",
        { slug: string },
        { hasPendingInvite: boolean; hasStudent: boolean; hasTeacher: boolean }
      >;
    };
    invites: {
      invite: FunctionReference<
        "mutation",
        "public",
        {
          email: string;
          locale: "en" | "id" | "de";
          personId: Id<"tenantPeople">;
          slug: string;
        },
        {
          email: string;
          expiresAt: number;
          id: Id<"tenantInvites">;
          name: string;
          personId: Id<"tenantPeople">;
          roles: Array<
            | "owner"
            | "admin"
            | "principal"
            | "deputy"
            | "teacher"
            | "counselor"
            | "staff"
            | "student"
            | "guardian"
            | "proctor"
            | "auditor"
            | "integration"
          >;
          status: "expired" | "pending";
        }
      >;
      list: FunctionReference<
        "query",
        "public",
        {
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          slug: string;
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            email: string;
            expiresAt: number;
            id: Id<"tenantInvites">;
            name: string;
            personId: Id<"tenantPeople">;
            roles: Array<
              | "owner"
              | "admin"
              | "principal"
              | "deputy"
              | "teacher"
              | "counselor"
              | "staff"
              | "student"
              | "guardian"
              | "proctor"
              | "auditor"
              | "integration"
            >;
            status: "expired" | "pending";
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
      resend: FunctionReference<
        "mutation",
        "public",
        {
          inviteId: Id<"tenantInvites">;
          locale: "en" | "id" | "de";
          slug: string;
        },
        {
          email: string;
          expiresAt: number;
          id: Id<"tenantInvites">;
          name: string;
          personId: Id<"tenantPeople">;
          roles: Array<
            | "owner"
            | "admin"
            | "principal"
            | "deputy"
            | "teacher"
            | "counselor"
            | "staff"
            | "student"
            | "guardian"
            | "proctor"
            | "auditor"
            | "integration"
          >;
          status: "expired" | "pending";
        }
      >;
      revoke: FunctionReference<
        "mutation",
        "public",
        { inviteId: Id<"tenantInvites">; slug: string },
        null
      >;
    };
    logo: {
      remove: FunctionReference<"mutation", "public", { slug: string }, {}>;
      set: FunctionReference<
        "mutation",
        "public",
        {
          contentType: "image/png" | "image/svg+xml";
          slug: string;
          storageId: Id<"_storage">;
        },
        | { _tag: "LogoSet"; logo: string }
        | { _tag: "LogoRefused"; reason: "size" }
      >;
      uploadUrl: FunctionReference<
        "mutation",
        "public",
        { slug: string },
        string
      >;
    };
    memberships: {
      list: FunctionReference<
        "query",
        "public",
        {
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            person: { id: Id<"tenantPeople">; name: string };
            tenant: {
              kind: "school" | "foundation";
              logo?: string;
              mascot: string;
              name: string;
              slug: string;
              status: "active" | "suspended";
            };
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
    };
    people: {
      create: FunctionReference<
        "mutation",
        "public",
        { name: string; slug: string },
        {
          account: "claimed" | "unclaimed";
          id: Id<"tenantPeople">;
          kind: "member" | "operator";
          name: string;
          status: "active" | "suspended" | "removed";
        }
      >;
      list: FunctionReference<
        "query",
        "public",
        {
          account?: "unclaimed";
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          slug: string;
          status: "active" | "suspended" | "removed";
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            account: "claimed" | "unclaimed";
            id: Id<"tenantPeople">;
            kind: "member" | "operator";
            name: string;
            status: "active" | "suspended" | "removed";
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
      remove: FunctionReference<
        "mutation",
        "public",
        { personId: Id<"tenantPeople">; slug: string },
        {
          account: "claimed" | "unclaimed";
          id: Id<"tenantPeople">;
          kind: "member" | "operator";
          name: string;
          status: "active" | "suspended" | "removed";
        }
      >;
      rename: FunctionReference<
        "mutation",
        "public",
        { name: string; personId: Id<"tenantPeople">; slug: string },
        {
          account: "claimed" | "unclaimed";
          id: Id<"tenantPeople">;
          kind: "member" | "operator";
          name: string;
          status: "active" | "suspended" | "removed";
        }
      >;
      students: FunctionReference<
        "query",
        "public",
        {
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          slug: string;
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            account: "claimed" | "unclaimed";
            id: Id<"tenantPeople">;
            kind: "member" | "operator";
            name: string;
            status: "active" | "suspended" | "removed";
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
    };
    periods: {
      archive: FunctionReference<
        "mutation",
        "public",
        { periodId: Id<"tenantPeriods">; slug: string },
        {
          end: string;
          id: Id<"tenantPeriods">;
          name: string;
          start: string;
          status: "planned" | "active" | "archived";
        }
      >;
      create: FunctionReference<
        "mutation",
        "public",
        {
          end: string;
          name: string;
          slug: string;
          start: string;
          unitId: Id<"tenantUnits">;
        },
        {
          end: string;
          id: Id<"tenantPeriods">;
          name: string;
          start: string;
          status: "planned" | "active" | "archived";
        }
      >;
      list: FunctionReference<
        "query",
        "public",
        {
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          slug: string;
          unitId: Id<"tenantUnits">;
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            end: string;
            id: Id<"tenantPeriods">;
            name: string;
            start: string;
            status: "planned" | "active" | "archived";
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
      open: FunctionReference<
        "mutation",
        "public",
        { periodId: Id<"tenantPeriods">; slug: string },
        {
          end: string;
          id: Id<"tenantPeriods">;
          name: string;
          start: string;
          status: "planned" | "active" | "archived";
        }
      >;
      rename: FunctionReference<
        "mutation",
        "public",
        { name: string; periodId: Id<"tenantPeriods">; slug: string },
        {
          end: string;
          id: Id<"tenantPeriods">;
          name: string;
          start: string;
          status: "planned" | "active" | "archived";
        }
      >;
      restore: FunctionReference<
        "mutation",
        "public",
        { periodId: Id<"tenantPeriods">; slug: string },
        {
          end: string;
          id: Id<"tenantPeriods">;
          name: string;
          start: string;
          status: "planned" | "active" | "archived";
        }
      >;
    };
    placements: {
      move: FunctionReference<
        "mutation",
        "public",
        {
          cohortId: Id<"tenantCohorts">;
          personId: Id<"tenantPeople">;
          slug: string;
        },
        {
          cohortId: Id<"tenantCohorts">;
          periodId: Id<"tenantPeriods">;
          personId: Id<"tenantPeople">;
        }
      >;
      place: FunctionReference<
        "mutation",
        "public",
        {
          cohortId: Id<"tenantCohorts">;
          personId: Id<"tenantPeople">;
          slug: string;
        },
        {
          cohortId: Id<"tenantCohorts">;
          periodId: Id<"tenantPeriods">;
          personId: Id<"tenantPeople">;
        }
      >;
    };
    profile: {
      get: FunctionReference<
        "query",
        "public",
        { slug: string },
        {
          kind: "school" | "foundation";
          logo?: string;
          mascot: string;
          name: string;
          slug: string;
          status: "active" | "suspended";
        }
      >;
      refusal: FunctionReference<"query", "public", { slug: string }, boolean>;
    };
    promotion: {
      apply: {
        apply: FunctionReference<
          "mutation",
          "public",
          { promotionId: Id<"tenantPromotions">; slug: string },
          {
            id: Id<"tenantPromotions">;
            progress: {
              cursor: string | null;
              direction: "apply" | "undo" | null;
              done: Array<"archive" | "cohorts" | "place" | "homeroom">;
              failure:
                | "AccessDenied"
                | "CohortHasHomeroom"
                | "CohortLimit"
                | "CohortNameTaken"
                | "PeriodActive"
                | "PersonAlreadyPlaced"
                | "PersonGraduated"
                | "PersonNotStudent"
                | "PersonNotTeacher"
                | "PersonPlacementLimit"
                | "PromotionCohortOccupied"
                | "PromotionPlanInvalid"
                | "SourcePeriodInvalid"
                | "TeacherHasHomeroom"
                | null;
              movedAt: number;
              running: boolean;
              step: "archive" | "cohorts" | "place" | "homeroom" | null;
            };
            returnReason: "cohorts" | "students" | "homeroom" | "other" | null;
            sourcePeriodId: Id<"tenantPeriods">;
            sources: Array<{
              cohortId: Id<"tenantCohorts">;
              homeroom: boolean;
              to:
                | { kind: "cohort"; name: string }
                | { kind: "graduate" }
                | { kind: "stay" };
            }>;
            state:
              | "draft"
              | "submitted"
              | "approved"
              | "applied"
              | "opened"
              | "cancelled";
            targetPeriodId: Id<"tenantPeriods">;
            targets: Array<{ grade: number; name: string }>;
          }
        >;
      };
      draft: {
        create: FunctionReference<
          "mutation",
          "public",
          {
            periodId: Id<"tenantPeriods">;
            slug: string;
            targetPeriodId: Id<"tenantPeriods">;
          },
          {
            id: Id<"tenantPromotions">;
            progress: {
              cursor: string | null;
              direction: "apply" | "undo" | null;
              done: Array<"archive" | "cohorts" | "place" | "homeroom">;
              failure:
                | "AccessDenied"
                | "CohortHasHomeroom"
                | "CohortLimit"
                | "CohortNameTaken"
                | "PeriodActive"
                | "PersonAlreadyPlaced"
                | "PersonGraduated"
                | "PersonNotStudent"
                | "PersonNotTeacher"
                | "PersonPlacementLimit"
                | "PromotionCohortOccupied"
                | "PromotionPlanInvalid"
                | "SourcePeriodInvalid"
                | "TeacherHasHomeroom"
                | null;
              movedAt: number;
              running: boolean;
              step: "archive" | "cohorts" | "place" | "homeroom" | null;
            };
            returnReason: "cohorts" | "students" | "homeroom" | "other" | null;
            sourcePeriodId: Id<"tenantPeriods">;
            sources: Array<{
              cohortId: Id<"tenantCohorts">;
              homeroom: boolean;
              to:
                | { kind: "cohort"; name: string }
                | { kind: "graduate" }
                | { kind: "stay" };
            }>;
            state:
              | "draft"
              | "submitted"
              | "approved"
              | "applied"
              | "opened"
              | "cancelled";
            targetPeriodId: Id<"tenantPeriods">;
            targets: Array<{ grade: number; name: string }>;
          }
        >;
        get: FunctionReference<
          "query",
          "public",
          { periodId: Id<"tenantPeriods">; slug: string },
          {
            id: Id<"tenantPromotions">;
            progress: {
              cursor: string | null;
              direction: "apply" | "undo" | null;
              done: Array<"archive" | "cohorts" | "place" | "homeroom">;
              failure:
                | "AccessDenied"
                | "CohortHasHomeroom"
                | "CohortLimit"
                | "CohortNameTaken"
                | "PeriodActive"
                | "PersonAlreadyPlaced"
                | "PersonGraduated"
                | "PersonNotStudent"
                | "PersonNotTeacher"
                | "PersonPlacementLimit"
                | "PromotionCohortOccupied"
                | "PromotionPlanInvalid"
                | "SourcePeriodInvalid"
                | "TeacherHasHomeroom"
                | null;
              movedAt: number;
              running: boolean;
              step: "archive" | "cohorts" | "place" | "homeroom" | null;
            };
            returnReason: "cohorts" | "students" | "homeroom" | "other" | null;
            sourcePeriodId: Id<"tenantPeriods">;
            sources: Array<{
              cohortId: Id<"tenantCohorts">;
              homeroom: boolean;
              to:
                | { kind: "cohort"; name: string }
                | { kind: "graduate" }
                | { kind: "stay" };
            }>;
            state:
              | "draft"
              | "submitted"
              | "approved"
              | "applied"
              | "opened"
              | "cancelled";
            targetPeriodId: Id<"tenantPeriods">;
            targets: Array<{ grade: number; name: string }>;
          } | null
        >;
        plan: FunctionReference<
          "mutation",
          "public",
          {
            promotionId: Id<"tenantPromotions">;
            slug: string;
            sources: Array<{
              cohortId: Id<"tenantCohorts">;
              homeroom: boolean;
              to:
                | { kind: "cohort"; name: string }
                | { kind: "graduate" }
                | { kind: "stay" };
            }>;
            targets: Array<{ grade: number; name: string }>;
          },
          {
            id: Id<"tenantPromotions">;
            progress: {
              cursor: string | null;
              direction: "apply" | "undo" | null;
              done: Array<"archive" | "cohorts" | "place" | "homeroom">;
              failure:
                | "AccessDenied"
                | "CohortHasHomeroom"
                | "CohortLimit"
                | "CohortNameTaken"
                | "PeriodActive"
                | "PersonAlreadyPlaced"
                | "PersonGraduated"
                | "PersonNotStudent"
                | "PersonNotTeacher"
                | "PersonPlacementLimit"
                | "PromotionCohortOccupied"
                | "PromotionPlanInvalid"
                | "SourcePeriodInvalid"
                | "TeacherHasHomeroom"
                | null;
              movedAt: number;
              running: boolean;
              step: "archive" | "cohorts" | "place" | "homeroom" | null;
            };
            returnReason: "cohorts" | "students" | "homeroom" | "other" | null;
            sourcePeriodId: Id<"tenantPeriods">;
            sources: Array<{
              cohortId: Id<"tenantCohorts">;
              homeroom: boolean;
              to:
                | { kind: "cohort"; name: string }
                | { kind: "graduate" }
                | { kind: "stay" };
            }>;
            state:
              | "draft"
              | "submitted"
              | "approved"
              | "applied"
              | "opened"
              | "cancelled";
            targetPeriodId: Id<"tenantPeriods">;
            targets: Array<{ grade: number; name: string }>;
          }
        >;
      };
      moves: {
        moves: FunctionReference<
          "query",
          "public",
          {
            paginationOpts: {
              cursor: string | null;
              endCursor?: string | null;
              id?: number;
              maximumBytesRead?: number;
              maximumRowsRead?: number;
              numItems: number;
            };
            promotionId: Id<"tenantPromotions">;
            slug: string;
          },
          {
            continueCursor: string;
            isDone: boolean;
            page: Array<{
              personId: Id<"tenantPeople">;
              to:
                | { kind: "cohort"; name: string }
                | { kind: "graduate" }
                | { kind: "stay" };
            }>;
            pageStatus?: "SplitRecommended" | "SplitRequired" | null;
            splitCursor?: string | null;
          }
        >;
        setMove: FunctionReference<
          "mutation",
          "public",
          {
            personId: Id<"tenantPeople">;
            promotionId: Id<"tenantPromotions">;
            slug: string;
            to:
              | { kind: "cohort"; name: string }
              | { kind: "graduate" }
              | { kind: "stay" }
              | null;
          },
          {
            id: Id<"tenantPromotions">;
            progress: {
              cursor: string | null;
              direction: "apply" | "undo" | null;
              done: Array<"archive" | "cohorts" | "place" | "homeroom">;
              failure:
                | "AccessDenied"
                | "CohortHasHomeroom"
                | "CohortLimit"
                | "CohortNameTaken"
                | "PeriodActive"
                | "PersonAlreadyPlaced"
                | "PersonGraduated"
                | "PersonNotStudent"
                | "PersonNotTeacher"
                | "PersonPlacementLimit"
                | "PromotionCohortOccupied"
                | "PromotionPlanInvalid"
                | "SourcePeriodInvalid"
                | "TeacherHasHomeroom"
                | null;
              movedAt: number;
              running: boolean;
              step: "archive" | "cohorts" | "place" | "homeroom" | null;
            };
            returnReason: "cohorts" | "students" | "homeroom" | "other" | null;
            sourcePeriodId: Id<"tenantPeriods">;
            sources: Array<{
              cohortId: Id<"tenantCohorts">;
              homeroom: boolean;
              to:
                | { kind: "cohort"; name: string }
                | { kind: "graduate" }
                | { kind: "stay" };
            }>;
            state:
              | "draft"
              | "submitted"
              | "approved"
              | "applied"
              | "opened"
              | "cancelled";
            targetPeriodId: Id<"tenantPeriods">;
            targets: Array<{ grade: number; name: string }>;
          }
        >;
      };
      review: {
        approve: FunctionReference<
          "mutation",
          "public",
          { promotionId: Id<"tenantPromotions">; slug: string },
          {
            id: Id<"tenantPromotions">;
            progress: {
              cursor: string | null;
              direction: "apply" | "undo" | null;
              done: Array<"archive" | "cohorts" | "place" | "homeroom">;
              failure:
                | "AccessDenied"
                | "CohortHasHomeroom"
                | "CohortLimit"
                | "CohortNameTaken"
                | "PeriodActive"
                | "PersonAlreadyPlaced"
                | "PersonGraduated"
                | "PersonNotStudent"
                | "PersonNotTeacher"
                | "PersonPlacementLimit"
                | "PromotionCohortOccupied"
                | "PromotionPlanInvalid"
                | "SourcePeriodInvalid"
                | "TeacherHasHomeroom"
                | null;
              movedAt: number;
              running: boolean;
              step: "archive" | "cohorts" | "place" | "homeroom" | null;
            };
            returnReason: "cohorts" | "students" | "homeroom" | "other" | null;
            sourcePeriodId: Id<"tenantPeriods">;
            sources: Array<{
              cohortId: Id<"tenantCohorts">;
              homeroom: boolean;
              to:
                | { kind: "cohort"; name: string }
                | { kind: "graduate" }
                | { kind: "stay" };
            }>;
            state:
              | "draft"
              | "submitted"
              | "approved"
              | "applied"
              | "opened"
              | "cancelled";
            targetPeriodId: Id<"tenantPeriods">;
            targets: Array<{ grade: number; name: string }>;
          }
        >;
        cancel: FunctionReference<
          "mutation",
          "public",
          { promotionId: Id<"tenantPromotions">; slug: string },
          {
            id: Id<"tenantPromotions">;
            progress: {
              cursor: string | null;
              direction: "apply" | "undo" | null;
              done: Array<"archive" | "cohorts" | "place" | "homeroom">;
              failure:
                | "AccessDenied"
                | "CohortHasHomeroom"
                | "CohortLimit"
                | "CohortNameTaken"
                | "PeriodActive"
                | "PersonAlreadyPlaced"
                | "PersonGraduated"
                | "PersonNotStudent"
                | "PersonNotTeacher"
                | "PersonPlacementLimit"
                | "PromotionCohortOccupied"
                | "PromotionPlanInvalid"
                | "SourcePeriodInvalid"
                | "TeacherHasHomeroom"
                | null;
              movedAt: number;
              running: boolean;
              step: "archive" | "cohorts" | "place" | "homeroom" | null;
            };
            returnReason: "cohorts" | "students" | "homeroom" | "other" | null;
            sourcePeriodId: Id<"tenantPeriods">;
            sources: Array<{
              cohortId: Id<"tenantCohorts">;
              homeroom: boolean;
              to:
                | { kind: "cohort"; name: string }
                | { kind: "graduate" }
                | { kind: "stay" };
            }>;
            state:
              | "draft"
              | "submitted"
              | "approved"
              | "applied"
              | "opened"
              | "cancelled";
            targetPeriodId: Id<"tenantPeriods">;
            targets: Array<{ grade: number; name: string }>;
          }
        >;
        returnToDraft: FunctionReference<
          "mutation",
          "public",
          {
            promotionId: Id<"tenantPromotions">;
            reason: "cohorts" | "students" | "homeroom" | "other";
            slug: string;
          },
          {
            id: Id<"tenantPromotions">;
            progress: {
              cursor: string | null;
              direction: "apply" | "undo" | null;
              done: Array<"archive" | "cohorts" | "place" | "homeroom">;
              failure:
                | "AccessDenied"
                | "CohortHasHomeroom"
                | "CohortLimit"
                | "CohortNameTaken"
                | "PeriodActive"
                | "PersonAlreadyPlaced"
                | "PersonGraduated"
                | "PersonNotStudent"
                | "PersonNotTeacher"
                | "PersonPlacementLimit"
                | "PromotionCohortOccupied"
                | "PromotionPlanInvalid"
                | "SourcePeriodInvalid"
                | "TeacherHasHomeroom"
                | null;
              movedAt: number;
              running: boolean;
              step: "archive" | "cohorts" | "place" | "homeroom" | null;
            };
            returnReason: "cohorts" | "students" | "homeroom" | "other" | null;
            sourcePeriodId: Id<"tenantPeriods">;
            sources: Array<{
              cohortId: Id<"tenantCohorts">;
              homeroom: boolean;
              to:
                | { kind: "cohort"; name: string }
                | { kind: "graduate" }
                | { kind: "stay" };
            }>;
            state:
              | "draft"
              | "submitted"
              | "approved"
              | "applied"
              | "opened"
              | "cancelled";
            targetPeriodId: Id<"tenantPeriods">;
            targets: Array<{ grade: number; name: string }>;
          }
        >;
        submit: FunctionReference<
          "mutation",
          "public",
          { promotionId: Id<"tenantPromotions">; slug: string },
          {
            id: Id<"tenantPromotions">;
            progress: {
              cursor: string | null;
              direction: "apply" | "undo" | null;
              done: Array<"archive" | "cohorts" | "place" | "homeroom">;
              failure:
                | "AccessDenied"
                | "CohortHasHomeroom"
                | "CohortLimit"
                | "CohortNameTaken"
                | "PeriodActive"
                | "PersonAlreadyPlaced"
                | "PersonGraduated"
                | "PersonNotStudent"
                | "PersonNotTeacher"
                | "PersonPlacementLimit"
                | "PromotionCohortOccupied"
                | "PromotionPlanInvalid"
                | "SourcePeriodInvalid"
                | "TeacherHasHomeroom"
                | null;
              movedAt: number;
              running: boolean;
              step: "archive" | "cohorts" | "place" | "homeroom" | null;
            };
            returnReason: "cohorts" | "students" | "homeroom" | "other" | null;
            sourcePeriodId: Id<"tenantPeriods">;
            sources: Array<{
              cohortId: Id<"tenantCohorts">;
              homeroom: boolean;
              to:
                | { kind: "cohort"; name: string }
                | { kind: "graduate" }
                | { kind: "stay" };
            }>;
            state:
              | "draft"
              | "submitted"
              | "approved"
              | "applied"
              | "opened"
              | "cancelled";
            targetPeriodId: Id<"tenantPeriods">;
            targets: Array<{ grade: number; name: string }>;
          }
        >;
      };
      undo: {
        undo: FunctionReference<
          "mutation",
          "public",
          { promotionId: Id<"tenantPromotions">; slug: string },
          {
            id: Id<"tenantPromotions">;
            progress: {
              cursor: string | null;
              direction: "apply" | "undo" | null;
              done: Array<"archive" | "cohorts" | "place" | "homeroom">;
              failure:
                | "AccessDenied"
                | "CohortHasHomeroom"
                | "CohortLimit"
                | "CohortNameTaken"
                | "PeriodActive"
                | "PersonAlreadyPlaced"
                | "PersonGraduated"
                | "PersonNotStudent"
                | "PersonNotTeacher"
                | "PersonPlacementLimit"
                | "PromotionCohortOccupied"
                | "PromotionPlanInvalid"
                | "SourcePeriodInvalid"
                | "TeacherHasHomeroom"
                | null;
              movedAt: number;
              running: boolean;
              step: "archive" | "cohorts" | "place" | "homeroom" | null;
            };
            returnReason: "cohorts" | "students" | "homeroom" | "other" | null;
            sourcePeriodId: Id<"tenantPeriods">;
            sources: Array<{
              cohortId: Id<"tenantCohorts">;
              homeroom: boolean;
              to:
                | { kind: "cohort"; name: string }
                | { kind: "graduate" }
                | { kind: "stay" };
            }>;
            state:
              | "draft"
              | "submitted"
              | "approved"
              | "applied"
              | "opened"
              | "cancelled";
            targetPeriodId: Id<"tenantPeriods">;
            targets: Array<{ grade: number; name: string }>;
          }
        >;
      };
    };
    roster: {
      invite: FunctionReference<
        "mutation",
        "public",
        {
          email: string;
          locale: "en" | "id" | "de";
          name: string;
          role: "admin" | "teacher";
          slug: string;
        },
        { invite: Id<"tenantInvites">; person: Id<"tenantPeople"> }
      >;
      members: FunctionReference<
        "query",
        "public",
        {
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          slug: string;
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            id: Id<"tenantPeople">;
            name: string;
            roles: Array<
              | "owner"
              | "admin"
              | "principal"
              | "deputy"
              | "teacher"
              | "counselor"
              | "staff"
              | "student"
              | "guardian"
              | "proctor"
              | "auditor"
              | "integration"
            >;
            status: "cardIssued" | "invited" | "joined" | "notInvited";
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
    };
    settings: {
      setLocale: FunctionReference<
        "mutation",
        "public",
        { country: string; currency: string; slug: string },
        { country: string; currency: string }
      >;
      setName: FunctionReference<
        "mutation",
        "public",
        { name: string; slug: string },
        string
      >;
      setPolicy: FunctionReference<
        "mutation",
        "public",
        {
          policy:
            | { key: "emailDomains"; value: Array<string> }
            | { key: "nina"; value: boolean }
            | { key: "studentThreads"; value: boolean };
          slug: string;
        },
        { emailDomains: Array<string>; nina: boolean; studentThreads: boolean }
      >;
    };
    start: {
      address: FunctionReference<
        "query",
        "public",
        { slug: string },
        "free" | "taken" | "reserved" | "invalid"
      >;
      draft: FunctionReference<
        "query",
        "public",
        {},
        {
          country?: "ID" | "SG" | "GB" | "DE" | "US";
          levels?: Array<
            | "paud"
            | "sd"
            | "mi"
            | "smp"
            | "mts"
            | "sma"
            | "ma"
            | "smk"
            | "slb"
            | "other"
          >;
          name?: string;
          role?: "principal" | "teacher" | "admin" | "foundation";
          size?: "s" | "m" | "l" | "xl";
          slug?: string;
          updatedAt: number;
        } | null
      >;
      open: FunctionReference<
        "mutation",
        "public",
        {
          country: "ID" | "SG" | "GB" | "DE" | "US";
          name: string;
          role: "principal" | "teacher" | "admin" | "foundation";
          size: "s" | "m" | "l" | "xl";
          slug: string;
          timeZone: string;
          units: Array<{
            level:
              | "paud"
              | "sd"
              | "mi"
              | "smp"
              | "mts"
              | "sma"
              | "ma"
              | "smk"
              | "slb"
              | "other";
            name: string;
          }>;
        },
        { address: string; slug: string }
      >;
      save: FunctionReference<
        "mutation",
        "public",
        {
          answer:
            | { kind: "name"; name: string; slug: string }
            | { kind: "country"; value: "ID" | "SG" | "GB" | "DE" | "US" }
            | {
                kind: "levels";
                value: Array<
                  | "paud"
                  | "sd"
                  | "mi"
                  | "smp"
                  | "mts"
                  | "sma"
                  | "ma"
                  | "smk"
                  | "slb"
                  | "other"
                >;
              }
            | {
                kind: "role";
                value: "principal" | "teacher" | "admin" | "foundation";
              }
            | { kind: "size"; value: "s" | "m" | "l" | "xl" };
        },
        {
          country?: "ID" | "SG" | "GB" | "DE" | "US";
          levels?: Array<
            | "paud"
            | "sd"
            | "mi"
            | "smp"
            | "mts"
            | "sma"
            | "ma"
            | "smk"
            | "slb"
            | "other"
          >;
          name?: string;
          role?: "principal" | "teacher" | "admin" | "foundation";
          size?: "s" | "m" | "l" | "xl";
          slug?: string;
          updatedAt: number;
        }
      >;
    };
    units: {
      archive: FunctionReference<
        "mutation",
        "public",
        { slug: string; unitId: Id<"tenantUnits"> },
        "active" | "archived"
      >;
      create: FunctionReference<
        "mutation",
        "public",
        {
          contentLanguage: "en" | "id" | "de";
          level:
            | "paud"
            | "sd"
            | "mi"
            | "smp"
            | "mts"
            | "sma"
            | "ma"
            | "smk"
            | "slb"
            | "other";
          name: string;
          slug: string;
          timeZone: string;
        },
        {
          contentLanguage: "en" | "id" | "de";
          id: Id<"tenantUnits">;
          level:
            | "paud"
            | "sd"
            | "mi"
            | "smp"
            | "mts"
            | "sma"
            | "ma"
            | "smk"
            | "slb"
            | "other";
          name: string;
          npsn: string | null;
          status: "active" | "archived";
          timeZone: string;
        }
      >;
      list: FunctionReference<
        "query",
        "public",
        { slug: string },
        Array<{
          contentLanguage: "en" | "id" | "de";
          id: Id<"tenantUnits">;
          level:
            | "paud"
            | "sd"
            | "mi"
            | "smp"
            | "mts"
            | "sma"
            | "ma"
            | "smk"
            | "slb"
            | "other";
          name: string;
          npsn: string | null;
          status: "active" | "archived";
          timeZone: string;
        }>
      >;
      setLocale: FunctionReference<
        "mutation",
        "public",
        {
          contentLanguage: "en" | "id" | "de";
          slug: string;
          timeZone: string;
          unitId: Id<"tenantUnits">;
        },
        { contentLanguage: "en" | "id" | "de"; timeZone: string }
      >;
      setNpsn: FunctionReference<
        "mutation",
        "public",
        { npsn: string; slug: string; unitId: Id<"tenantUnits"> },
        string
      >;
      unarchive: FunctionReference<
        "mutation",
        "public",
        { slug: string; unitId: Id<"tenantUnits"> },
        "active" | "archived"
      >;
    };
    viewer: {
      get: FunctionReference<
        "query",
        "public",
        { slug: string },
        {
          account: {
            image?: string;
            mascot: string;
            name: string;
            username?: string;
          };
          can: Array<string>;
          grants: Array<{
            id: Id<"tenantGrants">;
            role: {
              key:
                | "owner"
                | "admin"
                | "principal"
                | "deputy"
                | "teacher"
                | "counselor"
                | "staff"
                | "student"
                | "guardian"
                | "proctor"
                | "auditor"
                | "integration";
              kind: "builtin";
            };
            scope:
              { kind: "tenant" } | { kind: "unit"; unitId: Id<"tenantUnits"> };
            term:
              { kind: "standing" } | { expiresAt: number; kind: "temporary" };
          }>;
          person: {
            id: Id<"tenantPeople">;
            kind: "member" | "operator";
            name: string;
          };
          tenant: {
            country: string;
            currency: string;
            id: Id<"tenants">;
            kind: "school" | "foundation";
            logo?: string;
            mascot: string;
            name: string;
            policies: {
              emailDomains: Array<string>;
              nina: boolean;
              studentThreads: boolean;
            };
            slug: string;
            status: "active" | "suspended";
          };
          units: Array<{
            can: Array<string>;
            contentLanguage: "en" | "id" | "de";
            id: Id<"tenantUnits">;
            level:
              | "paud"
              | "sd"
              | "mi"
              | "smp"
              | "mts"
              | "sma"
              | "ma"
              | "smk"
              | "slb"
              | "other";
            name: string;
            status: "active" | "archived";
            timeZone: string;
          }>;
        }
      >;
    };
  };
  tryouts: {
    mutations: {
      access: {
        trackPaywallView: FunctionReference<
          "mutation",
          "public",
          { source: "review" },
          null
        >;
      };
      attempts: {
        startAttempt: FunctionReference<
          "mutation",
          "public",
          {
            countryKey: string;
            destinationSectionKey?: string;
            entrySectionKey?: string;
            examKey: string;
            locale: "en" | "id" | "de";
            setKey: string;
            trackKey: string;
          },
          {
            attemptId: Id<"tryoutAttempts">;
            navigation: { publicPath: string };
          }
        >;
      };
      responses: {
        save: FunctionReference<
          "mutation",
          "public",
          {
            placementId: Id<"tryoutAttemptPlacements">;
            selection:
              | { kind: "single-choice"; optionKey: string }
              | { kind: "multiple-choice"; optionKeys: Array<string> }
              | {
                  assignments: Array<{
                    categoryKey: string;
                    statementKey: string;
                  }>;
                  kind: "category";
                }
              | { kind: "short-answer"; number?: string; text: string }
              | {
                  finalAnswers: Array<{
                    criterionKey: string;
                    number?: string;
                    text: string;
                  }>;
                  kind: "rubric";
                  text: string;
                }
              | null;
            version: number;
          },
          null
        >;
      };
      sections: {
        complete: FunctionReference<
          "mutation",
          "public",
          { attemptId: Id<"tryoutAttempts">; sectionKey: string },
          { kind: "completed" }
        >;
        start: FunctionReference<
          "mutation",
          "public",
          { attemptId: Id<"tryoutAttempts">; sectionKey: string },
          { kind: "started" }
        >;
      };
    };
    queries: {
      access: {
        getStartAccess: FunctionReference<
          "query",
          "public",
          {
            countryKey: string;
            destinationSectionKey?: string;
            examKey: string;
            locale: "en" | "id" | "de";
            now: number;
            setKey: string;
            trackKey: string;
          },
          { kind: "free-attempt" } | { kind: "included" }
        >;
      };
      attempt: {
        isLockedByAttemptId: FunctionReference<
          "query",
          "public",
          { attemptId: string },
          boolean
        >;
      };
      attemptPage: {
        getSection: FunctionReference<
          "query",
          "public",
          {
            request:
              | {
                  countryKey: string;
                  examKey: string;
                  kind: "current";
                  locale: "en" | "id" | "de";
                  sectionKey: string;
                  setKey: string;
                  trackKey: string;
                }
              | {
                  attemptId: string;
                  kind: "retained";
                  locale: "en" | "id" | "de";
                  publicPath: string;
                };
          },
          | null
          | {
              attemptId: Id<"tryoutAttempts">;
              kind: "redirect";
              publicPath: string;
            }
          | {
              activeSectionPublicPath: string | null;
              activeSetPublicPath: string | null;
              attemptId: Id<"tryoutAttempts">;
              content:
                | { kind: "none" }
                | {
                    answers: Array<{
                      appLocale: "en" | "id" | "de";
                      artifactHash: string;
                      bundleHash: string;
                      contentHash: string;
                      contentKey: string;
                      delivery: "entitled";
                      questionOrder: number;
                      sectionKey: string;
                      snapshotId: string;
                      snapshotReleaseId: string;
                      sourcePath: string;
                      sourceRevision: string;
                    }>;
                    kind: "signed";
                    previewAnswers: Array<{
                      appLocale: "en" | "id" | "de";
                      artifactHash: string;
                      bundleHash: string;
                      contentHash: string;
                      contentKey: string;
                      delivery: "entitled";
                      questionOrder: number;
                      sectionKey: string;
                      snapshotId: string;
                      snapshotReleaseId: string;
                      sourcePath: string;
                      sourceRevision: string;
                    }>;
                    questions: Array<{
                      appLocale: "en" | "id" | "de";
                      artifactHash: string;
                      bundleHash: string;
                      contentHash: string;
                      contentKey: string;
                      delivery: "authenticated";
                      questionOrder: number;
                      sectionKey: string;
                      snapshotId: string;
                      snapshotReleaseId: string;
                      sourcePath: string;
                      sourceRevision: string;
                    }>;
                  };
              initialState: {
                attempt: {
                  activeSectionKey: string | null;
                  attemptId: Id<"tryoutAttempts">;
                  attemptNumber: number;
                  completedSectionKeys: Array<string>;
                  expiresAt: number;
                  resumeSectionKey: string | null;
                  resumeSectionPublicPath: string | null;
                  score: {
                    publishedScore: number;
                    rawScore: number;
                    scoreStatus: "provisional" | "official";
                    scoringStrategy: "irt" | "penalized" | "raw" | "weighted";
                    theta?: number;
                    thetaSE?: number;
                    totalCorrect: number;
                    totalQuestions: number;
                  } | null;
                  section: {
                    answeredCount: number;
                    completedAt: number | null;
                    endReason: "submitted" | "time-expired" | null;
                    expiresAt: number;
                    score: {
                      publishedScore: number;
                      rawScore: number;
                      scoreStatus: "provisional" | "official";
                      scoringStrategy: "irt" | "penalized" | "raw" | "weighted";
                      theta?: number;
                      thetaSE?: number;
                      totalCorrect: number;
                      totalQuestions: number;
                    } | null;
                    sectionKey: string;
                    startedAt: number;
                    status: "in-progress" | "completed" | "expired";
                    totalQuestions: number;
                  } | null;
                  startedAt: number;
                  status: "in-progress" | "completed" | "expired";
                };
                runtime: null | {
                  attemptId: Id<"tryoutAttempts">;
                  expiresAt: number;
                  questions: Array<{
                    contentHash: string;
                    placementId: Id<"tryoutAttemptPlacements">;
                    questionOrder: number;
                    response: {
                      answeredAt: number;
                      isComplete: boolean;
                      outcome?:
                        | { status: "correct" }
                        | { status: "incorrect" }
                        | { points: number; status: "partial" }
                        | { status: "pending" };
                      selection:
                        | { kind: "single-choice"; optionKey: string }
                        | { kind: "multiple-choice"; optionKeys: Array<string> }
                        | {
                            assignments: Array<{
                              categoryKey: string;
                              statementKey: string;
                            }>;
                            kind: "category";
                          }
                        | {
                            kind: "short-answer";
                            number?: string;
                            text: string;
                          }
                        | {
                            finalAnswers: Array<{
                              criterionKey: string;
                              number?: string;
                              text: string;
                            }>;
                            kind: "rubric";
                            text: string;
                          };
                      updatedAt: number;
                    } | null;
                    responseSpec:
                      | {
                          kind: "single-choice";
                          options: Array<{
                            isCorrect?: boolean;
                            label: string;
                            optionKey: string;
                            order: number;
                          }>;
                        }
                      | {
                          kind: "multiple-choice";
                          options: Array<{
                            isCorrect?: boolean;
                            label: string;
                            optionKey: string;
                            order: number;
                          }>;
                        }
                      | {
                          categories: Array<{
                            categoryKey: string;
                            label: string;
                            order: number;
                          }>;
                          kind: "category";
                          statements: Array<{
                            correctCategoryKey?: string;
                            label: string;
                            order: number;
                            statementKey: string;
                          }>;
                        }
                      | {
                          key?:
                            | {
                                acceptsFractions: boolean;
                                kind: "number";
                                tolerance?: {
                                  kind: "absolute" | "relative";
                                  value: string;
                                };
                                value: string;
                              }
                            | {
                                acceptedAnswers: Array<string>;
                                collapseWhitespace: boolean;
                                ignoreCase: boolean;
                                kind: "text";
                              };
                          kind: "short-answer";
                          language: "en" | "id" | "de";
                        }
                      | {
                          criteria: Array<{
                            criterionKey: string;
                            final: boolean;
                            finalAnswer?:
                              | {
                                  acceptsFractions: boolean;
                                  kind: "number";
                                  tolerance?: {
                                    kind: "absolute" | "relative";
                                    value: string;
                                  };
                                  value: string;
                                }
                              | {
                                  acceptedAnswers: Array<string>;
                                  collapseWhitespace: boolean;
                                  ignoreCase: boolean;
                                  kind: "text";
                                };
                            label?: { de: string; en: string; id: string };
                            levels?: Array<{
                              label: { de: string; en: string; id: string };
                              levelKey: string;
                              order: number;
                              points: number;
                            }>;
                            order: number;
                          }>;
                          kind: "rubric";
                          language: "en" | "id" | "de";
                        };
                    sourcePath: string;
                    sourceRevision: string;
                    version?: number;
                  }>;
                  section: {
                    answeredCount: number;
                    completedAt: number | null;
                    endReason: "submitted" | "time-expired" | null;
                    expiresAt: number;
                    score: {
                      publishedScore: number;
                      rawScore: number;
                      scoreStatus: "provisional" | "official";
                      scoringStrategy: "irt" | "penalized" | "raw" | "weighted";
                      theta?: number;
                      thetaSE?: number;
                      totalCorrect: number;
                      totalQuestions: number;
                    } | null;
                    sectionKey: string;
                    startedAt: number;
                    status: "in-progress" | "completed" | "expired";
                    totalQuestions: number;
                  };
                };
              };
              kind: "retained";
              page: {
                exam: {
                  description?: string;
                  examKey: string;
                  publicPath: string;
                  scoringStrategy: "irt" | "penalized" | "raw";
                  title: string;
                };
                section: {
                  description?: string;
                  publicPath?: string;
                  questionCount: number;
                  sectionKey: string;
                  timeLimitSeconds: number;
                  title: string;
                  visibility: "internal-entry" | "visible";
                };
                set: {
                  countryKey: string;
                  description?: string;
                  examKey: string;
                  publicPath: string;
                  readyQuestionCount: number;
                  readyVisibleSectionCount: number;
                  scoringStrategy: "irt" | "penalized" | "raw";
                  sectionCount: number;
                  setKey: string;
                  title: string;
                  totalQuestionCount: number;
                  trackKey: string;
                  visibleSectionCount: number;
                };
                track: {
                  description?: string;
                  publicPath: string;
                  readyQuestionCount: number;
                  readyVisibleSectionCount: number;
                  title: string;
                  trackKey: string;
                  trackKind: "institution" | "subject" | "year";
                };
              };
            }
        >;
        getSectionWithBodies: FunctionReference<
          "query",
          "public",
          {
            request:
              | {
                  countryKey: string;
                  examKey: string;
                  kind: "current";
                  locale: "en" | "id" | "de";
                  sectionKey: string;
                  setKey: string;
                  trackKey: string;
                }
              | {
                  attemptId: string;
                  kind: "retained";
                  locale: "en" | "id" | "de";
                  publicPath: string;
                };
          },
          null | {
            attempt: {
              activeSectionPublicPath: string | null;
              activeSetPublicPath: string | null;
              attemptId: Id<"tryoutAttempts">;
              content:
                | { kind: "none" }
                | {
                    answers: Array<{
                      appLocale: "en" | "id" | "de";
                      artifactHash: string;
                      bundleHash: string;
                      contentHash: string;
                      contentKey: string;
                      delivery: "entitled";
                      questionOrder: number;
                      sectionKey: string;
                      snapshotId: string;
                      snapshotReleaseId: string;
                      sourcePath: string;
                      sourceRevision: string;
                    }>;
                    kind: "signed";
                    previewAnswers: Array<{
                      appLocale: "en" | "id" | "de";
                      artifactHash: string;
                      bundleHash: string;
                      contentHash: string;
                      contentKey: string;
                      delivery: "entitled";
                      questionOrder: number;
                      sectionKey: string;
                      snapshotId: string;
                      snapshotReleaseId: string;
                      sourcePath: string;
                      sourceRevision: string;
                    }>;
                    questions: Array<{
                      appLocale: "en" | "id" | "de";
                      artifactHash: string;
                      bundleHash: string;
                      contentHash: string;
                      contentKey: string;
                      delivery: "authenticated";
                      questionOrder: number;
                      sectionKey: string;
                      snapshotId: string;
                      snapshotReleaseId: string;
                      sourcePath: string;
                      sourceRevision: string;
                    }>;
                  };
              initialState: {
                attempt: {
                  activeSectionKey: string | null;
                  attemptId: Id<"tryoutAttempts">;
                  attemptNumber: number;
                  completedSectionKeys: Array<string>;
                  expiresAt: number;
                  resumeSectionKey: string | null;
                  resumeSectionPublicPath: string | null;
                  score: {
                    publishedScore: number;
                    rawScore: number;
                    scoreStatus: "provisional" | "official";
                    scoringStrategy: "irt" | "penalized" | "raw" | "weighted";
                    theta?: number;
                    thetaSE?: number;
                    totalCorrect: number;
                    totalQuestions: number;
                  } | null;
                  section: {
                    answeredCount: number;
                    completedAt: number | null;
                    endReason: "submitted" | "time-expired" | null;
                    expiresAt: number;
                    score: {
                      publishedScore: number;
                      rawScore: number;
                      scoreStatus: "provisional" | "official";
                      scoringStrategy: "irt" | "penalized" | "raw" | "weighted";
                      theta?: number;
                      thetaSE?: number;
                      totalCorrect: number;
                      totalQuestions: number;
                    } | null;
                    sectionKey: string;
                    startedAt: number;
                    status: "in-progress" | "completed" | "expired";
                    totalQuestions: number;
                  } | null;
                  startedAt: number;
                  status: "in-progress" | "completed" | "expired";
                };
                runtime: null | {
                  attemptId: Id<"tryoutAttempts">;
                  expiresAt: number;
                  questions: Array<{
                    contentHash: string;
                    placementId: Id<"tryoutAttemptPlacements">;
                    questionOrder: number;
                    response: {
                      answeredAt: number;
                      isComplete: boolean;
                      outcome?:
                        | { status: "correct" }
                        | { status: "incorrect" }
                        | { points: number; status: "partial" }
                        | { status: "pending" };
                      selection:
                        | { kind: "single-choice"; optionKey: string }
                        | { kind: "multiple-choice"; optionKeys: Array<string> }
                        | {
                            assignments: Array<{
                              categoryKey: string;
                              statementKey: string;
                            }>;
                            kind: "category";
                          }
                        | {
                            kind: "short-answer";
                            number?: string;
                            text: string;
                          }
                        | {
                            finalAnswers: Array<{
                              criterionKey: string;
                              number?: string;
                              text: string;
                            }>;
                            kind: "rubric";
                            text: string;
                          };
                      updatedAt: number;
                    } | null;
                    responseSpec:
                      | {
                          kind: "single-choice";
                          options: Array<{
                            isCorrect?: boolean;
                            label: string;
                            optionKey: string;
                            order: number;
                          }>;
                        }
                      | {
                          kind: "multiple-choice";
                          options: Array<{
                            isCorrect?: boolean;
                            label: string;
                            optionKey: string;
                            order: number;
                          }>;
                        }
                      | {
                          categories: Array<{
                            categoryKey: string;
                            label: string;
                            order: number;
                          }>;
                          kind: "category";
                          statements: Array<{
                            correctCategoryKey?: string;
                            label: string;
                            order: number;
                            statementKey: string;
                          }>;
                        }
                      | {
                          key?:
                            | {
                                acceptsFractions: boolean;
                                kind: "number";
                                tolerance?: {
                                  kind: "absolute" | "relative";
                                  value: string;
                                };
                                value: string;
                              }
                            | {
                                acceptedAnswers: Array<string>;
                                collapseWhitespace: boolean;
                                ignoreCase: boolean;
                                kind: "text";
                              };
                          kind: "short-answer";
                          language: "en" | "id" | "de";
                        }
                      | {
                          criteria: Array<{
                            criterionKey: string;
                            final: boolean;
                            finalAnswer?:
                              | {
                                  acceptsFractions: boolean;
                                  kind: "number";
                                  tolerance?: {
                                    kind: "absolute" | "relative";
                                    value: string;
                                  };
                                  value: string;
                                }
                              | {
                                  acceptedAnswers: Array<string>;
                                  collapseWhitespace: boolean;
                                  ignoreCase: boolean;
                                  kind: "text";
                                };
                            label?: { de: string; en: string; id: string };
                            levels?: Array<{
                              label: { de: string; en: string; id: string };
                              levelKey: string;
                              order: number;
                              points: number;
                            }>;
                            order: number;
                          }>;
                          kind: "rubric";
                          language: "en" | "id" | "de";
                        };
                    sourcePath: string;
                    sourceRevision: string;
                    version?: number;
                  }>;
                  section: {
                    answeredCount: number;
                    completedAt: number | null;
                    endReason: "submitted" | "time-expired" | null;
                    expiresAt: number;
                    score: {
                      publishedScore: number;
                      rawScore: number;
                      scoreStatus: "provisional" | "official";
                      scoringStrategy: "irt" | "penalized" | "raw" | "weighted";
                      theta?: number;
                      thetaSE?: number;
                      totalCorrect: number;
                      totalQuestions: number;
                    } | null;
                    sectionKey: string;
                    startedAt: number;
                    status: "in-progress" | "completed" | "expired";
                    totalQuestions: number;
                  };
                };
              };
              kind: "retained";
              page: {
                exam: {
                  description?: string;
                  examKey: string;
                  publicPath: string;
                  scoringStrategy: "irt" | "penalized" | "raw";
                  title: string;
                };
                section: {
                  description?: string;
                  publicPath?: string;
                  questionCount: number;
                  sectionKey: string;
                  timeLimitSeconds: number;
                  title: string;
                  visibility: "internal-entry" | "visible";
                };
                set: {
                  countryKey: string;
                  description?: string;
                  examKey: string;
                  publicPath: string;
                  readyQuestionCount: number;
                  readyVisibleSectionCount: number;
                  scoringStrategy: "irt" | "penalized" | "raw";
                  sectionCount: number;
                  setKey: string;
                  title: string;
                  totalQuestionCount: number;
                  trackKey: string;
                  visibleSectionCount: number;
                };
                track: {
                  description?: string;
                  publicPath: string;
                  readyQuestionCount: number;
                  readyVisibleSectionCount: number;
                  title: string;
                  trackKey: string;
                  trackKind: "institution" | "subject" | "year";
                };
              };
            };
            bodies: Array<{
              bundleJson: string;
              items: Array<{
                artifactJson: string;
                delivery: "authenticated" | "entitled";
                sourcePath: string;
              }>;
              rendererJson: string;
            } | null>;
          }
        >;
        getSet: FunctionReference<
          "query",
          "public",
          {
            request:
              | {
                  countryKey: string;
                  examKey: string;
                  kind: "current";
                  locale: "en" | "id" | "de";
                  setKey: string;
                  trackKey: string;
                }
              | {
                  attemptId: string;
                  kind: "retained";
                  locale: "en" | "id" | "de";
                  publicPath: string;
                };
          },
          | null
          | {
              attemptId: Id<"tryoutAttempts">;
              kind: "redirect";
              publicPath: string;
            }
          | {
              attemptId: Id<"tryoutAttempts">;
              content:
                | { kind: "none" }
                | {
                    answers: Array<{
                      appLocale: "en" | "id" | "de";
                      artifactHash: string;
                      bundleHash: string;
                      contentHash: string;
                      contentKey: string;
                      delivery: "entitled";
                      questionOrder: number;
                      sectionKey: string;
                      snapshotId: string;
                      snapshotReleaseId: string;
                      sourcePath: string;
                      sourceRevision: string;
                    }>;
                    kind: "signed";
                    previewAnswers: Array<{
                      appLocale: "en" | "id" | "de";
                      artifactHash: string;
                      bundleHash: string;
                      contentHash: string;
                      contentKey: string;
                      delivery: "entitled";
                      questionOrder: number;
                      sectionKey: string;
                      snapshotId: string;
                      snapshotReleaseId: string;
                      sourcePath: string;
                      sourceRevision: string;
                    }>;
                    questions: Array<{
                      appLocale: "en" | "id" | "de";
                      artifactHash: string;
                      bundleHash: string;
                      contentHash: string;
                      contentKey: string;
                      delivery: "authenticated";
                      questionOrder: number;
                      sectionKey: string;
                      snapshotId: string;
                      snapshotReleaseId: string;
                      sourcePath: string;
                      sourceRevision: string;
                    }>;
                  };
              initialState: {
                attempt: {
                  activeSectionKey: string | null;
                  attemptId: Id<"tryoutAttempts">;
                  attemptNumber: number;
                  completedSectionKeys: Array<string>;
                  expiresAt: number;
                  resumeSectionKey: string | null;
                  resumeSectionPublicPath: string | null;
                  score: {
                    publishedScore: number;
                    rawScore: number;
                    scoreStatus: "provisional" | "official";
                    scoringStrategy: "irt" | "penalized" | "raw" | "weighted";
                    theta?: number;
                    thetaSE?: number;
                    totalCorrect: number;
                    totalQuestions: number;
                  } | null;
                  section: {
                    answeredCount: number;
                    completedAt: number | null;
                    endReason: "submitted" | "time-expired" | null;
                    expiresAt: number;
                    score: {
                      publishedScore: number;
                      rawScore: number;
                      scoreStatus: "provisional" | "official";
                      scoringStrategy: "irt" | "penalized" | "raw" | "weighted";
                      theta?: number;
                      thetaSE?: number;
                      totalCorrect: number;
                      totalQuestions: number;
                    } | null;
                    sectionKey: string;
                    startedAt: number;
                    status: "in-progress" | "completed" | "expired";
                    totalQuestions: number;
                  } | null;
                  startedAt: number;
                  status: "in-progress" | "completed" | "expired";
                };
                runtime: null | {
                  attemptId: Id<"tryoutAttempts">;
                  expiresAt: number;
                  questions: Array<{
                    contentHash: string;
                    placementId: Id<"tryoutAttemptPlacements">;
                    questionOrder: number;
                    response: {
                      answeredAt: number;
                      isComplete: boolean;
                      outcome?:
                        | { status: "correct" }
                        | { status: "incorrect" }
                        | { points: number; status: "partial" }
                        | { status: "pending" };
                      selection:
                        | { kind: "single-choice"; optionKey: string }
                        | { kind: "multiple-choice"; optionKeys: Array<string> }
                        | {
                            assignments: Array<{
                              categoryKey: string;
                              statementKey: string;
                            }>;
                            kind: "category";
                          }
                        | {
                            kind: "short-answer";
                            number?: string;
                            text: string;
                          }
                        | {
                            finalAnswers: Array<{
                              criterionKey: string;
                              number?: string;
                              text: string;
                            }>;
                            kind: "rubric";
                            text: string;
                          };
                      updatedAt: number;
                    } | null;
                    responseSpec:
                      | {
                          kind: "single-choice";
                          options: Array<{
                            isCorrect?: boolean;
                            label: string;
                            optionKey: string;
                            order: number;
                          }>;
                        }
                      | {
                          kind: "multiple-choice";
                          options: Array<{
                            isCorrect?: boolean;
                            label: string;
                            optionKey: string;
                            order: number;
                          }>;
                        }
                      | {
                          categories: Array<{
                            categoryKey: string;
                            label: string;
                            order: number;
                          }>;
                          kind: "category";
                          statements: Array<{
                            correctCategoryKey?: string;
                            label: string;
                            order: number;
                            statementKey: string;
                          }>;
                        }
                      | {
                          key?:
                            | {
                                acceptsFractions: boolean;
                                kind: "number";
                                tolerance?: {
                                  kind: "absolute" | "relative";
                                  value: string;
                                };
                                value: string;
                              }
                            | {
                                acceptedAnswers: Array<string>;
                                collapseWhitespace: boolean;
                                ignoreCase: boolean;
                                kind: "text";
                              };
                          kind: "short-answer";
                          language: "en" | "id" | "de";
                        }
                      | {
                          criteria: Array<{
                            criterionKey: string;
                            final: boolean;
                            finalAnswer?:
                              | {
                                  acceptsFractions: boolean;
                                  kind: "number";
                                  tolerance?: {
                                    kind: "absolute" | "relative";
                                    value: string;
                                  };
                                  value: string;
                                }
                              | {
                                  acceptedAnswers: Array<string>;
                                  collapseWhitespace: boolean;
                                  ignoreCase: boolean;
                                  kind: "text";
                                };
                            label?: { de: string; en: string; id: string };
                            levels?: Array<{
                              label: { de: string; en: string; id: string };
                              levelKey: string;
                              order: number;
                              points: number;
                            }>;
                            order: number;
                          }>;
                          kind: "rubric";
                          language: "en" | "id" | "de";
                        };
                    sourcePath: string;
                    sourceRevision: string;
                    version?: number;
                  }>;
                  section: {
                    answeredCount: number;
                    completedAt: number | null;
                    endReason: "submitted" | "time-expired" | null;
                    expiresAt: number;
                    score: {
                      publishedScore: number;
                      rawScore: number;
                      scoreStatus: "provisional" | "official";
                      scoringStrategy: "irt" | "penalized" | "raw" | "weighted";
                      theta?: number;
                      thetaSE?: number;
                      totalCorrect: number;
                      totalQuestions: number;
                    } | null;
                    sectionKey: string;
                    startedAt: number;
                    status: "in-progress" | "completed" | "expired";
                    totalQuestions: number;
                  };
                };
              };
              kind: "current";
              page: {
                entrySection: {
                  description?: string;
                  publicPath?: string;
                  questionCount: number;
                  sectionKey: string;
                  timeLimitSeconds: number;
                  title: string;
                  visibility: "internal-entry" | "visible";
                } | null;
                exam: {
                  description?: string;
                  examKey: string;
                  publicPath: string;
                  scoringStrategy: "irt" | "penalized" | "raw";
                  title: string;
                };
                sections: Array<{
                  description?: string;
                  publicPath?: string;
                  questionCount: number;
                  sectionKey: string;
                  timeLimitSeconds: number;
                  title: string;
                  visibility: "internal-entry" | "visible";
                }>;
                set: {
                  countryKey: string;
                  description?: string;
                  examKey: string;
                  publicPath: string;
                  readyQuestionCount: number;
                  readyVisibleSectionCount: number;
                  scoringStrategy: "irt" | "penalized" | "raw";
                  sectionCount: number;
                  setKey: string;
                  title: string;
                  totalQuestionCount: number;
                  trackKey: string;
                  visibleSectionCount: number;
                };
                track: {
                  description?: string;
                  publicPath: string;
                  readyQuestionCount: number;
                  readyVisibleSectionCount: number;
                  title: string;
                  trackKey: string;
                  trackKind: "institution" | "subject" | "year";
                };
              };
              restartTarget: {
                entrySection: {
                  description?: string;
                  publicPath?: string;
                  questionCount: number;
                  sectionKey: string;
                  timeLimitSeconds: number;
                  title: string;
                  visibility: "internal-entry" | "visible";
                };
                setPublicPath: string;
              } | null;
            }
          | {
              attemptId: Id<"tryoutAttempts">;
              content:
                | { kind: "none" }
                | {
                    answers: Array<{
                      appLocale: "en" | "id" | "de";
                      artifactHash: string;
                      bundleHash: string;
                      contentHash: string;
                      contentKey: string;
                      delivery: "entitled";
                      questionOrder: number;
                      sectionKey: string;
                      snapshotId: string;
                      snapshotReleaseId: string;
                      sourcePath: string;
                      sourceRevision: string;
                    }>;
                    kind: "signed";
                    previewAnswers: Array<{
                      appLocale: "en" | "id" | "de";
                      artifactHash: string;
                      bundleHash: string;
                      contentHash: string;
                      contentKey: string;
                      delivery: "entitled";
                      questionOrder: number;
                      sectionKey: string;
                      snapshotId: string;
                      snapshotReleaseId: string;
                      sourcePath: string;
                      sourceRevision: string;
                    }>;
                    questions: Array<{
                      appLocale: "en" | "id" | "de";
                      artifactHash: string;
                      bundleHash: string;
                      contentHash: string;
                      contentKey: string;
                      delivery: "authenticated";
                      questionOrder: number;
                      sectionKey: string;
                      snapshotId: string;
                      snapshotReleaseId: string;
                      sourcePath: string;
                      sourceRevision: string;
                    }>;
                  };
              initialState: {
                attempt: {
                  activeSectionKey: string | null;
                  attemptId: Id<"tryoutAttempts">;
                  attemptNumber: number;
                  completedSectionKeys: Array<string>;
                  expiresAt: number;
                  resumeSectionKey: string | null;
                  resumeSectionPublicPath: string | null;
                  score: {
                    publishedScore: number;
                    rawScore: number;
                    scoreStatus: "provisional" | "official";
                    scoringStrategy: "irt" | "penalized" | "raw" | "weighted";
                    theta?: number;
                    thetaSE?: number;
                    totalCorrect: number;
                    totalQuestions: number;
                  } | null;
                  section: {
                    answeredCount: number;
                    completedAt: number | null;
                    endReason: "submitted" | "time-expired" | null;
                    expiresAt: number;
                    score: {
                      publishedScore: number;
                      rawScore: number;
                      scoreStatus: "provisional" | "official";
                      scoringStrategy: "irt" | "penalized" | "raw" | "weighted";
                      theta?: number;
                      thetaSE?: number;
                      totalCorrect: number;
                      totalQuestions: number;
                    } | null;
                    sectionKey: string;
                    startedAt: number;
                    status: "in-progress" | "completed" | "expired";
                    totalQuestions: number;
                  } | null;
                  startedAt: number;
                  status: "in-progress" | "completed" | "expired";
                };
                runtime: null | {
                  attemptId: Id<"tryoutAttempts">;
                  expiresAt: number;
                  questions: Array<{
                    contentHash: string;
                    placementId: Id<"tryoutAttemptPlacements">;
                    questionOrder: number;
                    response: {
                      answeredAt: number;
                      isComplete: boolean;
                      outcome?:
                        | { status: "correct" }
                        | { status: "incorrect" }
                        | { points: number; status: "partial" }
                        | { status: "pending" };
                      selection:
                        | { kind: "single-choice"; optionKey: string }
                        | { kind: "multiple-choice"; optionKeys: Array<string> }
                        | {
                            assignments: Array<{
                              categoryKey: string;
                              statementKey: string;
                            }>;
                            kind: "category";
                          }
                        | {
                            kind: "short-answer";
                            number?: string;
                            text: string;
                          }
                        | {
                            finalAnswers: Array<{
                              criterionKey: string;
                              number?: string;
                              text: string;
                            }>;
                            kind: "rubric";
                            text: string;
                          };
                      updatedAt: number;
                    } | null;
                    responseSpec:
                      | {
                          kind: "single-choice";
                          options: Array<{
                            isCorrect?: boolean;
                            label: string;
                            optionKey: string;
                            order: number;
                          }>;
                        }
                      | {
                          kind: "multiple-choice";
                          options: Array<{
                            isCorrect?: boolean;
                            label: string;
                            optionKey: string;
                            order: number;
                          }>;
                        }
                      | {
                          categories: Array<{
                            categoryKey: string;
                            label: string;
                            order: number;
                          }>;
                          kind: "category";
                          statements: Array<{
                            correctCategoryKey?: string;
                            label: string;
                            order: number;
                            statementKey: string;
                          }>;
                        }
                      | {
                          key?:
                            | {
                                acceptsFractions: boolean;
                                kind: "number";
                                tolerance?: {
                                  kind: "absolute" | "relative";
                                  value: string;
                                };
                                value: string;
                              }
                            | {
                                acceptedAnswers: Array<string>;
                                collapseWhitespace: boolean;
                                ignoreCase: boolean;
                                kind: "text";
                              };
                          kind: "short-answer";
                          language: "en" | "id" | "de";
                        }
                      | {
                          criteria: Array<{
                            criterionKey: string;
                            final: boolean;
                            finalAnswer?:
                              | {
                                  acceptsFractions: boolean;
                                  kind: "number";
                                  tolerance?: {
                                    kind: "absolute" | "relative";
                                    value: string;
                                  };
                                  value: string;
                                }
                              | {
                                  acceptedAnswers: Array<string>;
                                  collapseWhitespace: boolean;
                                  ignoreCase: boolean;
                                  kind: "text";
                                };
                            label?: { de: string; en: string; id: string };
                            levels?: Array<{
                              label: { de: string; en: string; id: string };
                              levelKey: string;
                              order: number;
                              points: number;
                            }>;
                            order: number;
                          }>;
                          kind: "rubric";
                          language: "en" | "id" | "de";
                        };
                    sourcePath: string;
                    sourceRevision: string;
                    version?: number;
                  }>;
                  section: {
                    answeredCount: number;
                    completedAt: number | null;
                    endReason: "submitted" | "time-expired" | null;
                    expiresAt: number;
                    score: {
                      publishedScore: number;
                      rawScore: number;
                      scoreStatus: "provisional" | "official";
                      scoringStrategy: "irt" | "penalized" | "raw" | "weighted";
                      theta?: number;
                      thetaSE?: number;
                      totalCorrect: number;
                      totalQuestions: number;
                    } | null;
                    sectionKey: string;
                    startedAt: number;
                    status: "in-progress" | "completed" | "expired";
                    totalQuestions: number;
                  };
                };
              };
              kind: "retained";
              page: {
                entrySection: {
                  description?: string;
                  publicPath?: string;
                  questionCount: number;
                  sectionKey: string;
                  timeLimitSeconds: number;
                  title: string;
                  visibility: "internal-entry" | "visible";
                } | null;
                exam: {
                  description?: string;
                  examKey: string;
                  publicPath: string;
                  scoringStrategy: "irt" | "penalized" | "raw";
                  title: string;
                };
                sections: Array<{
                  description?: string;
                  publicPath?: string;
                  questionCount: number;
                  sectionKey: string;
                  timeLimitSeconds: number;
                  title: string;
                  visibility: "internal-entry" | "visible";
                }>;
                set: {
                  countryKey: string;
                  description?: string;
                  examKey: string;
                  publicPath: string;
                  readyQuestionCount: number;
                  readyVisibleSectionCount: number;
                  scoringStrategy: "irt" | "penalized" | "raw";
                  sectionCount: number;
                  setKey: string;
                  title: string;
                  totalQuestionCount: number;
                  trackKey: string;
                  visibleSectionCount: number;
                };
                track: {
                  description?: string;
                  publicPath: string;
                  readyQuestionCount: number;
                  readyVisibleSectionCount: number;
                  title: string;
                  trackKey: string;
                  trackKind: "institution" | "subject" | "year";
                };
              };
              restartTarget: {
                entrySection: {
                  description?: string;
                  publicPath?: string;
                  questionCount: number;
                  sectionKey: string;
                  timeLimitSeconds: number;
                  title: string;
                  visibility: "internal-entry" | "visible";
                };
                setPublicPath: string;
              } | null;
            }
        >;
      };
      catalog: {
        getCountryPage: FunctionReference<
          "query",
          "public",
          { appLocale: "en" | "id" | "de"; publicPath: string },
          null | {
            country: {
              countryCode: string;
              countryKey: string;
              description?: string;
              publicPath: string;
              title: string;
            };
            exams: Array<{
              description?: string;
              examKey: string;
              publicPath: string;
              scoringStrategy: "irt" | "penalized" | "raw";
              title: string;
            }>;
            sourceRevision: string | null;
          }
        >;
        getExamPage: FunctionReference<
          "query",
          "public",
          { appLocale: "en" | "id" | "de"; publicPath: string },
          null | {
            country: {
              countryCode: string;
              countryKey: string;
              description?: string;
              publicPath: string;
              title: string;
            };
            exam: {
              description?: string;
              examKey: string;
              publicPath: string;
              scoringStrategy: "irt" | "penalized" | "raw";
              title: string;
            };
            tracks: Array<{
              description?: string;
              publicPath: string;
              readyQuestionCount: number;
              readyVisibleSectionCount: number;
              title: string;
              trackKey: string;
              trackKind: "institution" | "subject" | "year";
            }>;
          }
        >;
        getFeaturedQuestion: FunctionReference<
          "query",
          "public",
          { appLocale: "en" | "id" | "de" },
          {
            question: {
              appLocale: "en" | "id" | "de";
              artifactHash: string;
              bundleHash: string;
              contentHash: string;
              contentKey: string;
              delivery: "authenticated";
              questionOrder: number;
              sectionKey: string;
              snapshotId: string;
              snapshotReleaseId: string;
              sourcePath: string;
              sourceRevision: string;
            };
            response:
              | {
                  kind: "single-choice";
                  options: Array<{
                    isCorrect: boolean;
                    label: string;
                    optionKey: string;
                    order: number;
                  }>;
                }
              | {
                  kind: "multiple-choice";
                  options: Array<{
                    isCorrect: boolean;
                    label: string;
                    optionKey: string;
                    order: number;
                  }>;
                }
              | {
                  categories: Array<{
                    categoryKey: string;
                    label: string;
                    order: number;
                  }>;
                  kind: "category";
                  statements: Array<{
                    correctCategoryKey: string;
                    label: string;
                    order: number;
                    statementKey: string;
                  }>;
                }
              | {
                  key:
                    | {
                        acceptsFractions: boolean;
                        kind: "number";
                        tolerance?: {
                          kind: "absolute" | "relative";
                          value: string;
                        };
                        value: string;
                      }
                    | {
                        acceptedAnswers: Array<string>;
                        collapseWhitespace: boolean;
                        ignoreCase: boolean;
                        kind: "text";
                      };
                  kind: "short-answer";
                  language: "en" | "id" | "de";
                }
              | {
                  criteria: Array<{
                    criterionKey: string;
                    finalAnswer?:
                      | {
                          acceptsFractions: boolean;
                          kind: "number";
                          tolerance?: {
                            kind: "absolute" | "relative";
                            value: string;
                          };
                          value: string;
                        }
                      | {
                          acceptedAnswers: Array<string>;
                          collapseWhitespace: boolean;
                          ignoreCase: boolean;
                          kind: "text";
                        };
                    label: { de: string; en: string; id: string };
                    levels: Array<{
                      label: { de: string; en: string; id: string };
                      levelKey: string;
                      order: number;
                      points: number;
                    }>;
                    order: number;
                  }>;
                  kind: "rubric";
                  language: "en" | "id" | "de";
                };
          }
        >;
        getHubPage: FunctionReference<
          "query",
          "public",
          { appLocale: "en" | "id" | "de" },
          {
            countries: Array<{
              countryCode: string;
              countryKey: string;
              description?: string;
              examCount: number;
              publicPath: string;
              title: string;
            }>;
            sourceRevision: string | null;
          }
        >;
        getLocalizedPath: FunctionReference<
          "query",
          "public",
          {
            currentAppLocale: "en" | "id" | "de";
            publicPath: string;
            targetAppLocale: "en" | "id" | "de";
          },
          string | null
        >;
        getMetadata: FunctionReference<
          "query",
          "public",
          {
            appLocale: "en" | "id" | "de";
            kind: "country" | "exam" | "track" | "set" | "section";
            publicPath: string;
          },
          {
            route: null | {
              alternates: Array<{
                appLocale: "en" | "id" | "de";
                publicPath: string;
              }>;
              description?: string;
              publicPath: string;
              socialImageIdentity: null | {
                countryKey: string;
                examKey: string;
              };
              title: string;
            };
          }
        >;
        getSectionPage: FunctionReference<
          "query",
          "public",
          { appLocale: "en" | "id" | "de"; publicPath: string },
          null | {
            exam: {
              description?: string;
              examKey: string;
              publicPath: string;
              scoringStrategy: "irt" | "penalized" | "raw";
              title: string;
            };
            section: {
              description?: string;
              publicPath?: string;
              questionCount: number;
              sectionKey: string;
              timeLimitSeconds: number;
              title: string;
              visibility: "internal-entry" | "visible";
            };
            set: {
              countryKey: string;
              description?: string;
              examKey: string;
              publicPath: string;
              readyQuestionCount: number;
              readyVisibleSectionCount: number;
              scoringStrategy: "irt" | "penalized" | "raw";
              sectionCount: number;
              setKey: string;
              title: string;
              totalQuestionCount: number;
              trackKey: string;
              visibleSectionCount: number;
            };
            track: {
              description?: string;
              publicPath: string;
              readyQuestionCount: number;
              readyVisibleSectionCount: number;
              title: string;
              trackKey: string;
              trackKind: "institution" | "subject" | "year";
            };
          }
        >;
        getSetPage: FunctionReference<
          "query",
          "public",
          { appLocale: "en" | "id" | "de"; publicPath: string },
          null | {
            entrySection: {
              description?: string;
              publicPath?: string;
              questionCount: number;
              sectionKey: string;
              timeLimitSeconds: number;
              title: string;
              visibility: "internal-entry" | "visible";
            } | null;
            exam: {
              description?: string;
              examKey: string;
              publicPath: string;
              scoringStrategy: "irt" | "penalized" | "raw";
              title: string;
            };
            sections: Array<{
              description?: string;
              publicPath?: string;
              questionCount: number;
              sectionKey: string;
              timeLimitSeconds: number;
              title: string;
              visibility: "internal-entry" | "visible";
            }>;
            set: {
              countryKey: string;
              description?: string;
              examKey: string;
              publicPath: string;
              readyQuestionCount: number;
              readyVisibleSectionCount: number;
              scoringStrategy: "irt" | "penalized" | "raw";
              sectionCount: number;
              setKey: string;
              title: string;
              totalQuestionCount: number;
              trackKey: string;
              visibleSectionCount: number;
            };
            track: {
              description?: string;
              publicPath: string;
              readyQuestionCount: number;
              readyVisibleSectionCount: number;
              title: string;
              trackKey: string;
              trackKind: "institution" | "subject" | "year";
            };
          }
        >;
        getTrackPage: FunctionReference<
          "query",
          "public",
          { appLocale: "en" | "id" | "de"; publicPath: string },
          null | {
            country: {
              countryCode: string;
              countryKey: string;
              description?: string;
              publicPath: string;
              title: string;
            };
            exam: {
              description?: string;
              examKey: string;
              publicPath: string;
              scoringStrategy: "irt" | "penalized" | "raw";
              title: string;
            };
            track: {
              description?: string;
              publicPath: string;
              readyQuestionCount: number;
              readyVisibleSectionCount: number;
              title: string;
              trackKey: string;
              trackKind: "institution" | "subject" | "year";
            };
          }
        >;
      };
      content: {
        getBatch: FunctionReference<
          "query",
          "public",
          {
            attemptId: Id<"tryoutAttempts">;
            selectors: Array<
              | {
                  appLocale: "en" | "id" | "de";
                  artifactHash: string;
                  bundleHash: string;
                  contentHash: string;
                  contentKey: string;
                  delivery: "authenticated";
                  questionOrder: number;
                  sectionKey: string;
                  snapshotId: string;
                  snapshotReleaseId: string;
                  sourcePath: string;
                  sourceRevision: string;
                }
              | {
                  appLocale: "en" | "id" | "de";
                  artifactHash: string;
                  bundleHash: string;
                  contentHash: string;
                  contentKey: string;
                  delivery: "entitled";
                  questionOrder: number;
                  sectionKey: string;
                  snapshotId: string;
                  snapshotReleaseId: string;
                  sourcePath: string;
                  sourceRevision: string;
                }
            >;
          },
          null | {
            bundleJson: string;
            items: Array<{
              artifactJson: string;
              delivery: "authenticated" | "entitled";
              sourcePath: string;
            }>;
            rendererJson: string;
          }
        >;
      };
      history: {
        bySet: FunctionReference<
          "query",
          "public",
          {
            countryKey: string;
            examKey: string;
            locale: "en" | "id" | "de";
            paginationOpts: {
              cursor: string | null;
              endCursor?: string | null;
              id?: number;
              maximumBytesRead?: number;
              maximumRowsRead?: number;
              numItems: number;
            };
            setKey: string;
            trackKey: string;
          },
          {
            continueCursor: string;
            isDone: boolean;
            page: Array<{
              attemptId: Id<"tryoutAttempts">;
              attemptNumber: number;
              completedAt: number | null;
              score: {
                publishedScore: number;
                rawScore: number;
                scoreStatus: "provisional" | "official";
                scoringStrategy: "irt" | "penalized" | "raw" | "weighted";
                theta?: number;
                thetaSE?: number;
                totalCorrect: number;
                totalQuestions: number;
              } | null;
              startedAt: number;
              status: "in-progress" | "completed" | "expired";
            }>;
            pageStatus?: "SplitRecommended" | "SplitRequired" | null;
            splitCursor?: string | null;
          }
        >;
      };
      runtime: {
        getSectionAttemptState: FunctionReference<
          "query",
          "public",
          {
            attemptId: Id<"tryoutAttempts">;
            locale: "en" | "id" | "de";
            sectionKey: string;
          },
          null | {
            attempt: {
              activeSectionKey: string | null;
              attemptId: Id<"tryoutAttempts">;
              attemptNumber: number;
              completedSectionKeys: Array<string>;
              expiresAt: number;
              resumeSectionKey: string | null;
              resumeSectionPublicPath: string | null;
              score: {
                publishedScore: number;
                rawScore: number;
                scoreStatus: "provisional" | "official";
                scoringStrategy: "irt" | "penalized" | "raw" | "weighted";
                theta?: number;
                thetaSE?: number;
                totalCorrect: number;
                totalQuestions: number;
              } | null;
              section: {
                answeredCount: number;
                completedAt: number | null;
                endReason: "submitted" | "time-expired" | null;
                expiresAt: number;
                score: {
                  publishedScore: number;
                  rawScore: number;
                  scoreStatus: "provisional" | "official";
                  scoringStrategy: "irt" | "penalized" | "raw" | "weighted";
                  theta?: number;
                  thetaSE?: number;
                  totalCorrect: number;
                  totalQuestions: number;
                } | null;
                sectionKey: string;
                startedAt: number;
                status: "in-progress" | "completed" | "expired";
                totalQuestions: number;
              } | null;
              startedAt: number;
              status: "in-progress" | "completed" | "expired";
            };
            runtime: null | {
              attemptId: Id<"tryoutAttempts">;
              expiresAt: number;
              questions: Array<{
                contentHash: string;
                placementId: Id<"tryoutAttemptPlacements">;
                questionOrder: number;
                response: {
                  answeredAt: number;
                  isComplete: boolean;
                  outcome?:
                    | { status: "correct" }
                    | { status: "incorrect" }
                    | { points: number; status: "partial" }
                    | { status: "pending" };
                  selection:
                    | { kind: "single-choice"; optionKey: string }
                    | { kind: "multiple-choice"; optionKeys: Array<string> }
                    | {
                        assignments: Array<{
                          categoryKey: string;
                          statementKey: string;
                        }>;
                        kind: "category";
                      }
                    | { kind: "short-answer"; number?: string; text: string }
                    | {
                        finalAnswers: Array<{
                          criterionKey: string;
                          number?: string;
                          text: string;
                        }>;
                        kind: "rubric";
                        text: string;
                      };
                  updatedAt: number;
                } | null;
                responseSpec:
                  | {
                      kind: "single-choice";
                      options: Array<{
                        isCorrect?: boolean;
                        label: string;
                        optionKey: string;
                        order: number;
                      }>;
                    }
                  | {
                      kind: "multiple-choice";
                      options: Array<{
                        isCorrect?: boolean;
                        label: string;
                        optionKey: string;
                        order: number;
                      }>;
                    }
                  | {
                      categories: Array<{
                        categoryKey: string;
                        label: string;
                        order: number;
                      }>;
                      kind: "category";
                      statements: Array<{
                        correctCategoryKey?: string;
                        label: string;
                        order: number;
                        statementKey: string;
                      }>;
                    }
                  | {
                      key?:
                        | {
                            acceptsFractions: boolean;
                            kind: "number";
                            tolerance?: {
                              kind: "absolute" | "relative";
                              value: string;
                            };
                            value: string;
                          }
                        | {
                            acceptedAnswers: Array<string>;
                            collapseWhitespace: boolean;
                            ignoreCase: boolean;
                            kind: "text";
                          };
                      kind: "short-answer";
                      language: "en" | "id" | "de";
                    }
                  | {
                      criteria: Array<{
                        criterionKey: string;
                        final: boolean;
                        finalAnswer?:
                          | {
                              acceptsFractions: boolean;
                              kind: "number";
                              tolerance?: {
                                kind: "absolute" | "relative";
                                value: string;
                              };
                              value: string;
                            }
                          | {
                              acceptedAnswers: Array<string>;
                              collapseWhitespace: boolean;
                              ignoreCase: boolean;
                              kind: "text";
                            };
                        label?: { de: string; en: string; id: string };
                        levels?: Array<{
                          label: { de: string; en: string; id: string };
                          levelKey: string;
                          order: number;
                          points: number;
                        }>;
                        order: number;
                      }>;
                      kind: "rubric";
                      language: "en" | "id" | "de";
                    };
                sourcePath: string;
                sourceRevision: string;
                version?: number;
              }>;
              section: {
                answeredCount: number;
                completedAt: number | null;
                endReason: "submitted" | "time-expired" | null;
                expiresAt: number;
                score: {
                  publishedScore: number;
                  rawScore: number;
                  scoreStatus: "provisional" | "official";
                  scoringStrategy: "irt" | "penalized" | "raw" | "weighted";
                  theta?: number;
                  thetaSE?: number;
                  totalCorrect: number;
                  totalQuestions: number;
                } | null;
                sectionKey: string;
                startedAt: number;
                status: "in-progress" | "completed" | "expired";
                totalQuestions: number;
              };
            };
          }
        >;
        getSetAttemptState: FunctionReference<
          "query",
          "public",
          { attemptId: Id<"tryoutAttempts">; locale: "en" | "id" | "de" },
          null | {
            attempt: {
              activeSectionKey: string | null;
              attemptId: Id<"tryoutAttempts">;
              attemptNumber: number;
              completedSectionKeys: Array<string>;
              expiresAt: number;
              resumeSectionKey: string | null;
              resumeSectionPublicPath: string | null;
              score: {
                publishedScore: number;
                rawScore: number;
                scoreStatus: "provisional" | "official";
                scoringStrategy: "irt" | "penalized" | "raw" | "weighted";
                theta?: number;
                thetaSE?: number;
                totalCorrect: number;
                totalQuestions: number;
              } | null;
              section: {
                answeredCount: number;
                completedAt: number | null;
                endReason: "submitted" | "time-expired" | null;
                expiresAt: number;
                score: {
                  publishedScore: number;
                  rawScore: number;
                  scoreStatus: "provisional" | "official";
                  scoringStrategy: "irt" | "penalized" | "raw" | "weighted";
                  theta?: number;
                  thetaSE?: number;
                  totalCorrect: number;
                  totalQuestions: number;
                } | null;
                sectionKey: string;
                startedAt: number;
                status: "in-progress" | "completed" | "expired";
                totalQuestions: number;
              } | null;
              startedAt: number;
              status: "in-progress" | "completed" | "expired";
            };
            runtime: null | {
              attemptId: Id<"tryoutAttempts">;
              expiresAt: number;
              questions: Array<{
                contentHash: string;
                placementId: Id<"tryoutAttemptPlacements">;
                questionOrder: number;
                response: {
                  answeredAt: number;
                  isComplete: boolean;
                  outcome?:
                    | { status: "correct" }
                    | { status: "incorrect" }
                    | { points: number; status: "partial" }
                    | { status: "pending" };
                  selection:
                    | { kind: "single-choice"; optionKey: string }
                    | { kind: "multiple-choice"; optionKeys: Array<string> }
                    | {
                        assignments: Array<{
                          categoryKey: string;
                          statementKey: string;
                        }>;
                        kind: "category";
                      }
                    | { kind: "short-answer"; number?: string; text: string }
                    | {
                        finalAnswers: Array<{
                          criterionKey: string;
                          number?: string;
                          text: string;
                        }>;
                        kind: "rubric";
                        text: string;
                      };
                  updatedAt: number;
                } | null;
                responseSpec:
                  | {
                      kind: "single-choice";
                      options: Array<{
                        isCorrect?: boolean;
                        label: string;
                        optionKey: string;
                        order: number;
                      }>;
                    }
                  | {
                      kind: "multiple-choice";
                      options: Array<{
                        isCorrect?: boolean;
                        label: string;
                        optionKey: string;
                        order: number;
                      }>;
                    }
                  | {
                      categories: Array<{
                        categoryKey: string;
                        label: string;
                        order: number;
                      }>;
                      kind: "category";
                      statements: Array<{
                        correctCategoryKey?: string;
                        label: string;
                        order: number;
                        statementKey: string;
                      }>;
                    }
                  | {
                      key?:
                        | {
                            acceptsFractions: boolean;
                            kind: "number";
                            tolerance?: {
                              kind: "absolute" | "relative";
                              value: string;
                            };
                            value: string;
                          }
                        | {
                            acceptedAnswers: Array<string>;
                            collapseWhitespace: boolean;
                            ignoreCase: boolean;
                            kind: "text";
                          };
                      kind: "short-answer";
                      language: "en" | "id" | "de";
                    }
                  | {
                      criteria: Array<{
                        criterionKey: string;
                        final: boolean;
                        finalAnswer?:
                          | {
                              acceptsFractions: boolean;
                              kind: "number";
                              tolerance?: {
                                kind: "absolute" | "relative";
                                value: string;
                              };
                              value: string;
                            }
                          | {
                              acceptedAnswers: Array<string>;
                              collapseWhitespace: boolean;
                              ignoreCase: boolean;
                              kind: "text";
                            };
                        label?: { de: string; en: string; id: string };
                        levels?: Array<{
                          label: { de: string; en: string; id: string };
                          levelKey: string;
                          order: number;
                          points: number;
                        }>;
                        order: number;
                      }>;
                      kind: "rubric";
                      language: "en" | "id" | "de";
                    };
                sourcePath: string;
                sourceRevision: string;
                version?: number;
              }>;
              section: {
                answeredCount: number;
                completedAt: number | null;
                endReason: "submitted" | "time-expired" | null;
                expiresAt: number;
                score: {
                  publishedScore: number;
                  rawScore: number;
                  scoreStatus: "provisional" | "official";
                  scoringStrategy: "irt" | "penalized" | "raw" | "weighted";
                  theta?: number;
                  thetaSE?: number;
                  totalCorrect: number;
                  totalQuestions: number;
                } | null;
                sectionKey: string;
                startedAt: number;
                status: "in-progress" | "completed" | "expired";
                totalQuestions: number;
              };
            };
          }
        >;
      };
      sets: {
        list: FunctionReference<
          "query",
          "public",
          {
            countryKey: string;
            examKey: string;
            filter:
              "all" | "not-started" | "in-progress" | "completed" | "expired";
            locale: "en" | "id" | "de";
            paginationOpts: {
              cursor: string | null;
              endCursor?: string | null;
              id?: number;
              maximumBytesRead?: number;
              maximumRowsRead?: number;
              numItems: number;
            };
            sort: {
              direction: "asc" | "desc";
              field:
                | "order"
                | "publishedScore"
                | "readyQuestionCount"
                | "durationSeconds"
                | "title";
            };
            trackKey: string;
          },
          {
            continueCursor: string;
            isDone: boolean;
            page: Array<{
              attemptStatus: null | "in-progress" | "completed" | "expired";
              countryKey: string;
              description?: string;
              durationSeconds: number;
              examKey: string;
              publicPath: string;
              publishedScore: number | null;
              readyQuestionCount: number;
              readyVisibleSectionCount: number;
              runningAttempt: null | {
                attemptId: Id<"tryoutAttempts">;
                publicPath: string;
              };
              scoringStrategy: "irt" | "penalized" | "raw";
              sectionCount: number;
              setKey: string;
              title: string;
              totalQuestionCount: number;
              trackKey: string;
              visibleSectionCount: number;
            }>;
            pageStatus?: "SplitRecommended" | "SplitRequired" | null;
            snapshotId: string;
            splitCursor?: string | null;
            viewerId: string | null;
          }
        >;
      };
    };
  };
  users: {
    mutations: {
      setMascot: FunctionReference<
        "mutation",
        "public",
        { mascot: string },
        { mascot: string }
      >;
      setPicture: FunctionReference<
        "mutation",
        "public",
        { picture: "animal" | "photo" },
        null
      >;
      syncUserInfoForChat: FunctionReference<
        "mutation",
        "public",
        {},
        {
          credits: number;
          role:
            "teacher" | "student" | "parent" | "administrator" | null | null;
          userId: Id<"users">;
        }
      >;
      updateBio: FunctionReference<"mutation", "public", { bio: string }, null>;
      updateUsername: FunctionReference<
        "mutation",
        "public",
        { username: string },
        null
      >;
      updateUserName: FunctionReference<
        "mutation",
        "public",
        { name: string },
        null
      >;
      updateUserRole: FunctionReference<
        "mutation",
        "public",
        { role: "teacher" | "student" | "parent" },
        null
      >;
    };
    queries: {
      checkUsername: FunctionReference<
        "query",
        "public",
        { username: string },
        | "available"
        | "characters"
        | "letterFirst"
        | "tooShort"
        | "notAllowed"
        | "taken"
      >;
      getProfileByUsername: FunctionReference<
        "query",
        "public",
        { username: string },
        {
          _id: Id<"users">;
          bio?: string;
          image?: string;
          mascot: string;
          name: string;
          username: string;
        } | null
      >;
    };
  };
};

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: {
  analytics: {
    capture: {
      deliverProductEvent: FunctionReference<
        "action",
        "internal",
        {
          disableGeoip: boolean;
          distinctId: Id<"users">;
          event: string;
          properties?: string;
          timestamp?: number;
        },
        null
      >;
      isProductAnalyticsUserEligible: FunctionReference<
        "query",
        "internal",
        { userId: Id<"users"> },
        boolean
      >;
    };
    erasure: {
      action: {
        eraseUserAnalytics: FunctionReference<
          "action",
          "internal",
          { userId: Id<"users"> },
          null
        >;
      };
      workflow: {
        eraseConsentOverlap: FunctionReference<
          "mutation",
          "internal",
          {
            args?: { userId: Id<"users"> };
            context?: any;
            docs?: "To call a workflow directly, nest its arguments: { args: { ...yourWorkflowArgs } }";
            generationNumber?: number;
            onComplete?: string;
            startAsync?: boolean;
            workflowId?: string;
          },
          | string
          | {
              kind: "complete";
              runResult:
                | { kind: "success"; returnValue: null }
                | { error: string; kind: "failed" }
                | { kind: "canceled" };
            }
        >;
      };
    };
  };
  auth: {
    actions: {
      getLatestJwks: FunctionReference<
        "action",
        "internal",
        {},
        Array<{
          alg: "RS256";
          createdAt: number;
          expiresAt?: null | number;
          id: string;
          privateKey: string;
          publicKey: string;
        }>
      >;
    };
    cleanup: {
      cleanupDeletedUser: FunctionReference<
        "mutation",
        "internal",
        { userId: Id<"users"> },
        boolean
      >;
      drainDeletedUserData: FunctionReference<
        "action",
        "internal",
        { userId: Id<"users"> },
        null
      >;
    };
    deletion: {
      cancelAccountDeletion: FunctionReference<
        "mutation",
        "internal",
        {
          authId: string;
          expectedPreparation: {
            attemptId: string;
            preparationId: Id<"accountDeletionPreparations">;
            recoveryGeneration: number;
          };
        },
        null
      >;
      claimAccountDeletion: FunctionReference<
        "mutation",
        "internal",
        { attemptId: string; authId: string },
        "ready" | "temporarily-unavailable"
      >;
      cleanup: {
        cleanupDeletedUserAnalytics: FunctionReference<
          "mutation",
          "internal",
          {
            args?: { userId: Id<"users"> };
            context?: any;
            docs?: "To call a workflow directly, nest its arguments: { args: { ...yourWorkflowArgs } }";
            generationNumber?: number;
            onComplete?: string;
            startAsync?: boolean;
            workflowId?: string;
          },
          | string
          | {
              kind: "complete";
              runResult:
                | { kind: "success"; returnValue: null }
                | { error: string; kind: "failed" }
                | { kind: "canceled" };
            }
        >;
        cleanupDeletedUserAuth: FunctionReference<
          "mutation",
          "internal",
          {
            args?: { authId: string; userId: Id<"users"> };
            context?: any;
            docs?: "To call a workflow directly, nest its arguments: { args: { ...yourWorkflowArgs } }";
            generationNumber?: number;
            onComplete?: string;
            startAsync?: boolean;
            workflowId?: string;
          },
          | string
          | {
              kind: "complete";
              runResult:
                | { kind: "success"; returnValue: null }
                | { error: string; kind: "failed" }
                | { kind: "canceled" };
            }
        >;
        cleanupDeletedUserBilling: FunctionReference<
          "mutation",
          "internal",
          {
            args?: { userId: Id<"users"> };
            context?: any;
            docs?: "To call a workflow directly, nest its arguments: { args: { ...yourWorkflowArgs } }";
            generationNumber?: number;
            onComplete?: string;
            startAsync?: boolean;
            workflowId?: string;
          },
          | string
          | {
              kind: "complete";
              runResult:
                | { kind: "success"; returnValue: null }
                | { error: string; kind: "failed" }
                | { kind: "canceled" };
            }
        >;
        cleanupDeletedUserData: FunctionReference<
          "mutation",
          "internal",
          {
            args?: { userId: Id<"users"> };
            context?: any;
            docs?: "To call a workflow directly, nest its arguments: { args: { ...yourWorkflowArgs } }";
            generationNumber?: number;
            onComplete?: string;
            startAsync?: boolean;
            workflowId?: string;
          },
          | string
          | {
              kind: "complete";
              runResult:
                | { kind: "success"; returnValue: null }
                | { error: string; kind: "failed" }
                | { kind: "canceled" };
            }
        >;
      };
      continueAccountDeletionCommit: FunctionReference<
        "mutation",
        "internal",
        {
          authId: string;
          expectedPreparation: {
            attemptId: string;
            preparationId: Id<"accountDeletionPreparations">;
            recoveryGeneration: number;
          };
        },
        boolean
      >;
      recovery: {
        recoverAccountDeletion: FunctionReference<
          "action",
          "internal",
          {
            authId: string;
            expectedPreparation: {
              attemptId: string;
              preparationId: Id<"accountDeletionPreparations">;
              recoveryGeneration: number;
            };
          },
          null
        >;
        sweepAccountDeletionRecovery: FunctionReference<
          "mutation",
          "internal",
          {},
          null
        >;
      };
      sweepAccountDeletionRetention: FunctionReference<
        "mutation",
        "internal",
        {},
        null
      >;
      verification: {
        drainDeletedUserVerifications: FunctionReference<
          "action",
          "internal",
          { authId: string; userId: Id<"users"> },
          null
        >;
        loadDeletedUserVerificationCursor: FunctionReference<
          "query",
          "internal",
          { userId: Id<"users"> },
          null | string
        >;
        saveDeletedUserVerificationCursor: FunctionReference<
          "mutation",
          "internal",
          { cursor: null | string; userId: Id<"users"> },
          null
        >;
      };
      workflow: {
        finalizeDeletedUserCleanup: FunctionReference<
          "mutation",
          "internal",
          {
            authId: string;
            expectedPreparation?: {
              attemptId: string;
              preparationId: Id<"accountDeletionPreparations">;
              recoveryGeneration: number;
            };
          },
          null
        >;
        launchDeletedUserCleanup: FunctionReference<
          "mutation",
          "internal",
          { authId: string; userId: Id<"users"> },
          null
        >;
      };
    };
    lifecycle: {
      onCreate: FunctionReference<
        "mutation",
        "internal",
        { doc: any; model: string },
        any
      >;
      onDelete: FunctionReference<
        "mutation",
        "internal",
        { doc: any; model: string },
        any
      >;
      onUpdate: FunctionReference<
        "mutation",
        "internal",
        { model: string; newDoc: any; oldDoc: any },
        any
      >;
    };
  };
  billing: {
    checkout: {
      admitCheckout: FunctionReference<
        "mutation",
        "internal",
        {
          event:
            | {
                name: "content viewed";
                properties: {
                  alignment_id: string;
                  concept_id: string;
                  content_id: string;
                  content_type: "article" | "material" | "question";
                  context_key: string;
                  is_new_view: boolean;
                  learning_object_id: string;
                  lens_id: string;
                  locale: "en" | "id" | "de";
                  route: string;
                };
              }
            | {
                name: "tryout attempt started";
                properties: {
                  access_source: "free" | "subscription";
                  attempt_number: number;
                  country_key: string;
                  exam_key: string;
                  locale: "en" | "id" | "de";
                  score_status: "provisional" | "official";
                  set_key: string;
                  track_key: string;
                };
              }
            | {
                name: "tryout attempt completed";
                properties: {
                  attempt_number: number;
                  country_key: string;
                  exam_key: string;
                  locale: "en" | "id" | "de";
                  score_status: "provisional" | "official";
                  set_key: string;
                  total_questions: number;
                  track_key: string;
                };
              }
            | {
                name: "tryout paywall viewed";
                properties: { source: "review" };
              }
            | { name: "chat message sent"; properties: { chat_type: "study" } }
            | {
                name: "chat response completed";
                properties: {
                  chat_type: "study";
                  credits?: number;
                  input_tokens?: number;
                  output_tokens?: number;
                  total_tokens?: number;
                };
              }
            | {
                name: "chat response failed";
                properties: {
                  chat_type: "study";
                  error_code:
                    | "provider-busy"
                    | "provider-unavailable"
                    | "service-configuration"
                    | "request-rejected"
                    | "input-too-large"
                    | "response-timeout"
                    | "content-blocked"
                    | "response-limit"
                    | "interrupted"
                    | "unknown";
                };
              }
            | {
                name: "checkout started";
                properties: {
                  checkout_locale: "de" | "en";
                  customer_ip_available: boolean;
                  locale: "en" | "id" | "de";
                  product_count: number;
                  product_id: string;
                };
              }
            | {
                name: "subscription started";
                properties: { product_id: string; status: string };
              }
            | {
                name: "subscription canceled";
                properties: { product_id: string; status: string };
              }
            | {
                name: "plan changed";
                properties: {
                  new_plan: "free" | "pro";
                  previous_plan: "free" | "pro";
                };
              };
          timestamp?: number;
          userId: Id<"users">;
        },
        { kind: "admitted" } | { kind: "unavailable" }
      >;
      openAccount: FunctionReference<
        "mutation",
        "internal",
        { userId: Id<"users"> },
        | {
            accountId: Id<"billingAccounts">;
            email: string;
            kind: "open";
            name: string;
            providerCustomerId: string | null;
          }
        | { kind: "unavailable" }
      >;
      recordCustomer: FunctionReference<
        "mutation",
        "internal",
        { accountId: Id<"billingAccounts">; providerCustomerId: string },
        null
      >;
    };
    contracts: {
      recordSchoolContract: FunctionReference<
        "mutation",
        "internal",
        {
          contractId: string;
          seats: number;
          tenantSlug: string;
          validFrom: number;
          validTo: number;
        },
        { accountId: Id<"billingAccounts">; grantId: Id<"billingGrants"> }
      >;
    };
    deletion: {
      cleanupDeletedUserBilling: FunctionReference<
        "action",
        "internal",
        { userId: Id<"users"> },
        null
      >;
      deleteRows: FunctionReference<
        "mutation",
        "internal",
        { userId: Id<"users"> },
        boolean
      >;
      readAccounts: FunctionReference<
        "query",
        "internal",
        { userId: Id<"users"> },
        Array<{
          accountId: Id<"billingAccounts">;
          providerCustomerId: string | null;
          rail: "polar" | "xendit";
        }>
      >;
    };
    events: {
      cleanup: FunctionReference<"mutation", "internal", {}, number>;
      process: FunctionReference<
        "mutation",
        "internal",
        { eventId: Id<"billingEvents"> },
        null
      >;
      record: FunctionReference<
        "mutation",
        "internal",
        {
          key: string;
          payload: string;
          providerTime: number;
          rail: "polar" | "xendit";
          type: string;
        },
        { eventId: Id<"billingEvents">; kind: "accepted" | "duplicate" }
      >;
    };
    grants: {
      project: FunctionReference<
        "mutation",
        "internal",
        { userId: Id<"users"> },
        null
      >;
      projectSchool: FunctionReference<
        "mutation",
        "internal",
        { cursor: string | null; tenantId: Id<"tenants"> },
        null
      >;
    };
  };
  classroom: {
    seed: {
      teacher: FunctionReference<
        "mutation",
        "internal",
        {
          email: string;
          locale: "en" | "id" | "de";
          name: string;
          slug: string;
          subject: string;
        },
        {
          classId: Id<"classes">;
          invite: Id<"tenantInvites">;
          periodId: Id<"tenantPeriods">;
          person: Id<"tenantPeople">;
        }
      >;
    };
  };
  contentRelease: {
    accept: {
      accept: FunctionReference<
        "mutation",
        "internal",
        { recoveryId: string; releaseId: string },
        {
          complete: boolean;
          processedItems: number;
          releaseId: string;
          totalItems: number;
        }
      >;
    };
    activate: {
      activate: FunctionReference<
        "mutation",
        "internal",
        { manifestHash: string; releaseId: string; rendererJson: string },
        | {
            kind: "activated";
            receipt: {
              activatedHeads: number;
              activeAppLocales: Array<"en" | "id" | "de">;
              deletedHeads: number;
              manifestHash: string;
              projectionDigest: string;
              releaseId: string;
              resultCount: number;
              resultDigest: string;
              routeDigest: string;
              snapshots: {
                program: {
                  baseSnapshotId: string | null;
                  mode: "inherit" | "replace" | "restore";
                  resultSnapshotId: string | null;
                  rowCount: number;
                  rowDigest: string;
                };
                quran: {
                  baseSnapshotId: string | null;
                  mode: "inherit" | "replace" | "restore";
                  resultSnapshotId: string | null;
                  rowCount: number;
                  rowDigest: string;
                };
                tryout: {
                  baseSnapshotId: string | null;
                  mode: "inherit" | "replace" | "restore";
                  resultSnapshotId: string | null;
                  rowCount: number;
                  rowDigest: string;
                };
              };
              stagedArtifacts: number;
              stagedItems: number;
              stagedProjections: number;
              stagedRoutes: number;
              stagedSnapshotRows: number;
            };
          }
        | {
            kind: "completed";
            receipt: {
              activatedHeads: number;
              activeAppLocales: Array<"en" | "id" | "de">;
              deletedHeads: number;
              manifestHash: string;
              projectionDigest: string;
              releaseId: string;
              resultCount: number;
              resultDigest: string;
              routeDigest: string;
              snapshots: {
                program: {
                  baseSnapshotId: string | null;
                  mode: "inherit" | "replace" | "restore";
                  resultSnapshotId: string | null;
                  rowCount: number;
                  rowDigest: string;
                };
                quran: {
                  baseSnapshotId: string | null;
                  mode: "inherit" | "replace" | "restore";
                  resultSnapshotId: string | null;
                  rowCount: number;
                  rowDigest: string;
                };
                tryout: {
                  baseSnapshotId: string | null;
                  mode: "inherit" | "replace" | "restore";
                  resultSnapshotId: string | null;
                  rowCount: number;
                  rowDigest: string;
                };
              };
              stagedArtifacts: number;
              stagedItems: number;
              stagedProjections: number;
              stagedRoutes: number;
              stagedSnapshotRows: number;
            };
          }
      >;
      activateRecovery: FunctionReference<
        "mutation",
        "internal",
        { manifestHash: string; releaseId: string; rendererJson: string },
        | {
            kind: "activated";
            receipt: {
              activatedHeads: number;
              activeAppLocales: Array<"en" | "id" | "de">;
              deletedHeads: number;
              manifestHash: string;
              projectionDigest: string;
              releaseId: string;
              resultCount: number;
              resultDigest: string;
              routeDigest: string;
              snapshots: {
                program: {
                  baseSnapshotId: string | null;
                  mode: "inherit" | "replace" | "restore";
                  resultSnapshotId: string | null;
                  rowCount: number;
                  rowDigest: string;
                };
                quran: {
                  baseSnapshotId: string | null;
                  mode: "inherit" | "replace" | "restore";
                  resultSnapshotId: string | null;
                  rowCount: number;
                  rowDigest: string;
                };
                tryout: {
                  baseSnapshotId: string | null;
                  mode: "inherit" | "replace" | "restore";
                  resultSnapshotId: string | null;
                  rowCount: number;
                  rowDigest: string;
                };
              };
              stagedArtifacts: number;
              stagedItems: number;
              stagedProjections: number;
              stagedRoutes: number;
              stagedSnapshotRows: number;
            };
          }
        | {
            kind: "completed";
            receipt: {
              activatedHeads: number;
              activeAppLocales: Array<"en" | "id" | "de">;
              deletedHeads: number;
              manifestHash: string;
              projectionDigest: string;
              releaseId: string;
              resultCount: number;
              resultDigest: string;
              routeDigest: string;
              snapshots: {
                program: {
                  baseSnapshotId: string | null;
                  mode: "inherit" | "replace" | "restore";
                  resultSnapshotId: string | null;
                  rowCount: number;
                  rowDigest: string;
                };
                quran: {
                  baseSnapshotId: string | null;
                  mode: "inherit" | "replace" | "restore";
                  resultSnapshotId: string | null;
                  rowCount: number;
                  rowDigest: string;
                };
                tryout: {
                  baseSnapshotId: string | null;
                  mode: "inherit" | "replace" | "restore";
                  resultSnapshotId: string | null;
                  rowCount: number;
                  rowDigest: string;
                };
              };
              stagedArtifacts: number;
              stagedItems: number;
              stagedProjections: number;
              stagedRoutes: number;
              stagedSnapshotRows: number;
            };
          }
      >;
      prepare: FunctionReference<
        "mutation",
        "internal",
        { manifestHash: string; releaseId: string; rendererJson: string },
        { kind: "completed" } | { kind: "prepared" }
      >;
      prepareRecovery: FunctionReference<
        "mutation",
        "internal",
        { manifestHash: string; releaseId: string; rendererJson: string },
        { kind: "completed" } | { kind: "prepared" }
      >;
    };
    article: {
      internal: {
        readAgentTaxonomy: FunctionReference<
          "query",
          "internal",
          { appLocale: "en" | "id" | "de" },
          { categories: Array<string>; managed: boolean }
        >;
      };
    };
    artifacts: {
      stageArtifactBatch: FunctionReference<
        "mutation",
        "internal",
        { artifactJson: Array<string>; batchIndex: number; releaseId: string },
        {
          batchIndex: number;
          created: number;
          releaseId: string;
          unchanged: number;
        }
      >;
    };
    cleanup: {
      cleanup: FunctionReference<
        "mutation",
        "internal",
        { releaseId: string },
        {
          complete: boolean;
          deletedArtifacts: number;
          releaseId: string;
          retryAt?: number;
        }
      >;
    };
    compact: {
      page: FunctionReference<
        "mutation",
        "internal",
        {},
        {
          complete: boolean;
          deleted: number;
          floor: number;
          phase:
            | "heads"
            | "bindings"
            | "items"
            | "batches"
            | "facts"
            | "snapshots"
            | "releases";
        }
      >;
      run: FunctionReference<
        "action",
        "internal",
        {},
        {
          complete: boolean;
          deleted: number;
          floor: number;
          phase:
            | "heads"
            | "bindings"
            | "items"
            | "batches"
            | "facts"
            | "snapshots"
            | "releases";
        }
      >;
    };
    envelope: {
      byRelease: FunctionReference<
        "query",
        "internal",
        { releaseId: string },
        {
          releaseJson: string;
          rendererJson: string;
          role: "candidate" | "recovery";
        }
      >;
      get: FunctionReference<
        "query",
        "internal",
        { manifestHash: string; releaseId: string },
        { releaseJson: string; rendererJson: string }
      >;
    };
    heads: {
      page: FunctionReference<
        "query",
        "internal",
        {
          activeManifestHash: string;
          activeReleaseId: string;
          cursor: string | null;
          family: "article" | "material" | "page" | "question";
          limit: number;
        },
        {
          activeManifestHash: string;
          activeReleaseId: string;
          cursor: string | null;
          done: boolean;
          family: "article" | "material" | "page" | "question";
          heads: Array<{
            artifactHash: string;
            artifactLocale: "en" | "id" | "de";
            compilerConfigHash: string;
            contentKey: string;
            delivery: "public" | "authenticated" | "entitled";
            family: "article" | "material" | "page" | "question";
            projectionHash: string;
            publicPath?: string;
            rendererDomain:
              | "ai-ds"
              | "biology"
              | "chemistry"
              | "mathematics"
              | "physics"
              | "politics"
              | "site"
              | "snbt-general"
              | "snbt-math"
              | "snbt-plain"
              | "snbt-quant"
              | "tka-math";
            sourceHash: string;
            sourcePath: string;
          }>;
          nextCursor: string | null;
        }
      >;
    };
    ingress: {
      dispatch: {
        dispatch: FunctionReference<
          "action",
          "internal",
          { byteLength: number; source: string },
          { body: string; status: number }
        >;
      };
    };
    items: {
      stageItemBatch: FunctionReference<
        "mutation",
        "internal",
        { batchIndex: number; itemJson: Array<string>; releaseId: string },
        {
          batchIndex: number;
          created: number;
          releaseId: string;
          unchanged: number;
        }
      >;
      stageProjectionBatch: FunctionReference<
        "mutation",
        "internal",
        {
          batchIndex: number;
          projectionJson: Array<string>;
          releaseId: string;
        },
        {
          batchIndex: number;
          created: number;
          releaseId: string;
          unchanged: number;
        }
      >;
    };
    manifest: {
      abort: FunctionReference<
        "mutation",
        "internal",
        { releaseId: string },
        {
          complete: boolean;
          processedItems: number;
          releaseId: string;
          totalItems: number;
        }
      >;
      stageRecovery: FunctionReference<
        "mutation",
        "internal",
        { releaseJson: string; rendererJson: string },
        | {
            manifestHash: string;
            phase:
              | "missing"
              | "staging"
              | "verifying"
              | "verified"
              | "aborting"
              | "aborted";
            releaseId: string;
          }
        | {
            manifestHash: string;
            phase: "completed";
            receipt: {
              activatedHeads: number;
              activeAppLocales: Array<"en" | "id" | "de">;
              deletedHeads: number;
              manifestHash: string;
              projectionDigest: string;
              releaseId: string;
              resultCount: number;
              resultDigest: string;
              routeDigest: string;
              snapshots: {
                program: {
                  baseSnapshotId: string | null;
                  mode: "inherit" | "replace" | "restore";
                  resultSnapshotId: string | null;
                  rowCount: number;
                  rowDigest: string;
                };
                quran: {
                  baseSnapshotId: string | null;
                  mode: "inherit" | "replace" | "restore";
                  resultSnapshotId: string | null;
                  rowCount: number;
                  rowDigest: string;
                };
                tryout: {
                  baseSnapshotId: string | null;
                  mode: "inherit" | "replace" | "restore";
                  resultSnapshotId: string | null;
                  rowCount: number;
                  rowDigest: string;
                };
              };
              stagedArtifacts: number;
              stagedItems: number;
              stagedProjections: number;
              stagedRoutes: number;
              stagedSnapshotRows: number;
            };
            releaseId: string;
          }
      >;
      stageRelease: FunctionReference<
        "mutation",
        "internal",
        { releaseJson: string; rendererJson: string },
        | {
            manifestHash: string;
            phase:
              | "missing"
              | "staging"
              | "verifying"
              | "verified"
              | "aborting"
              | "aborted";
            releaseId: string;
          }
        | {
            manifestHash: string;
            phase: "completed";
            receipt: {
              activatedHeads: number;
              activeAppLocales: Array<"en" | "id" | "de">;
              deletedHeads: number;
              manifestHash: string;
              projectionDigest: string;
              releaseId: string;
              resultCount: number;
              resultDigest: string;
              routeDigest: string;
              snapshots: {
                program: {
                  baseSnapshotId: string | null;
                  mode: "inherit" | "replace" | "restore";
                  resultSnapshotId: string | null;
                  rowCount: number;
                  rowDigest: string;
                };
                quran: {
                  baseSnapshotId: string | null;
                  mode: "inherit" | "replace" | "restore";
                  resultSnapshotId: string | null;
                  rowCount: number;
                  rowDigest: string;
                };
                tryout: {
                  baseSnapshotId: string | null;
                  mode: "inherit" | "replace" | "restore";
                  resultSnapshotId: string | null;
                  rowCount: number;
                  rowDigest: string;
                };
              };
              stagedArtifacts: number;
              stagedItems: number;
              stagedProjections: number;
              stagedRoutes: number;
              stagedSnapshotRows: number;
            };
            releaseId: string;
          }
      >;
    };
    models: {
      restart: FunctionReference<
        "mutation",
        "internal",
        {
          expectedGeneration: number;
          expectedJobId: Id<"_scheduled_functions">;
          releaseId: string;
        },
        | {
            status: "restarted";
            syncGeneration: number;
            syncJobId: Id<"_scheduled_functions">;
          }
        | { status: "stale" }
      >;
      resume: FunctionReference<
        "mutation",
        "internal",
        { generation: number; releaseId: string },
        null
      >;
      status: FunctionReference<
        "query",
        "internal",
        { releaseId: string },
        | { phase: "completed"; releaseId: string }
        | { phase: "ready"; releaseId: string }
        | {
            phase: "building" | "failed";
            releaseId: string;
            syncGeneration: number;
            syncJobId: Id<"_scheduled_functions">;
          }
      >;
    };
    proof: {
      catalog: {
        page: FunctionReference<
          "query",
          "internal",
          {
            cursor: {
              artifactLocale: "en" | "id" | "de";
              contentKey: string;
            } | null;
            releaseId: string;
          },
          {
            done: boolean;
            heads: Array<{
              artifactHash: string;
              artifactLocale: "en" | "id" | "de";
              compilerConfigHash: string;
              contentKey: string;
              delivery: "public" | "authenticated" | "entitled";
              family: "article" | "material" | "page" | "question";
              projectionHash: string;
              publicPath?: string;
              rendererDomain:
                | "ai-ds"
                | "biology"
                | "chemistry"
                | "mathematics"
                | "physics"
                | "politics"
                | "site"
                | "snbt-general"
                | "snbt-math"
                | "snbt-plain"
                | "snbt-quant"
                | "tka-math";
              sourceHash: string;
              sourcePath: string;
            }>;
            nextCursor: {
              artifactLocale: "en" | "id" | "de";
              contentKey: string;
            } | null;
          }
        >;
      };
      commit: {
        commitProof: FunctionReference<
          "mutation",
          "internal",
          { proofJson: string },
          | {
              manifestHash: string;
              phase:
                | "missing"
                | "staging"
                | "verifying"
                | "verified"
                | "aborting"
                | "aborted";
              releaseId: string;
            }
          | {
              manifestHash: string;
              phase: "completed";
              receipt: {
                activatedHeads: number;
                activeAppLocales: Array<"en" | "id" | "de">;
                deletedHeads: number;
                manifestHash: string;
                projectionDigest: string;
                releaseId: string;
                resultCount: number;
                resultDigest: string;
                routeDigest: string;
                snapshots: {
                  program: {
                    baseSnapshotId: string | null;
                    mode: "inherit" | "replace" | "restore";
                    resultSnapshotId: string | null;
                    rowCount: number;
                    rowDigest: string;
                  };
                  quran: {
                    baseSnapshotId: string | null;
                    mode: "inherit" | "replace" | "restore";
                    resultSnapshotId: string | null;
                    rowCount: number;
                    rowDigest: string;
                  };
                  tryout: {
                    baseSnapshotId: string | null;
                    mode: "inherit" | "replace" | "restore";
                    resultSnapshotId: string | null;
                    rowCount: number;
                    rowDigest: string;
                  };
                };
                stagedArtifacts: number;
                stagedItems: number;
                stagedProjections: number;
                stagedRoutes: number;
                stagedSnapshotRows: number;
              };
              releaseId: string;
            }
        >;
      };
      poll: {
        poll: FunctionReference<
          "mutation",
          "internal",
          { manifestHash: string; releaseId: string },
          | { phase: "verifying" }
          | { phase: "verified"; proofJson: string }
          | { phase: "failed"; reason: "canceled" | "failed" }
        >;
        status: FunctionReference<
          "query",
          "internal",
          { manifestHash: string; releaseId: string },
          | { phase: "verifying" }
          | { phase: "verified"; proofJson: string }
          | { phase: "failed"; reason: "canceled" | "failed" }
          | { phase: "pending" }
        >;
      };
      read: {
        artifactBatch: FunctionReference<
          "query",
          "internal",
          { batchIndex: number; releaseId: string },
          {
            batchIndex: number;
            rows: Array<{
              artifactJson: string;
              index: number;
              itemJson: string;
            }>;
          }
        >;
        artifactPlan: FunctionReference<
          "query",
          "internal",
          { manifestHash: string; releaseId: string },
          { batchCount: number; stagedArtifacts: number }
        >;
        page: FunctionReference<
          "query",
          "internal",
          { afterIndex: number; releaseId: string },
          {
            done: boolean;
            nextIndex: number;
            rows: Array<{
              index: number;
              itemJson: string;
              projectionJson?: string;
              rollbackJson: string;
            }>;
          }
        >;
        routePage: FunctionReference<
          "query",
          "internal",
          { afterIndex: number; releaseId: string },
          {
            done: boolean;
            nextIndex: number;
            rows: Array<{ index: number; routeJson: string }>;
          }
        >;
        state: FunctionReference<
          "query",
          "internal",
          { manifestHash: string; releaseId: string },
          {
            checkedIndex: number;
            releaseJson: string;
            rendererJson: string;
            role: "candidate" | "recovery";
            stagedArtifacts: number;
            stagedDeletes: number;
            stagedItems: number;
            stagedProjections: number;
            stagedRoutes: number;
            stagedSnapshotBatches: number;
            stagedSnapshotRows: number;
            stagedUpserts: number;
            status: "verifying" | "verified";
          }
        >;
      };
      routes: {
        routes: FunctionReference<
          "query",
          "internal",
          { cursor: string | null; releaseId: string },
          { checked: number; done: boolean; nextCursor: string | null }
        >;
      };
      verify: {
        verifyArtifacts: FunctionReference<
          "action",
          "internal",
          { batchIndex: number; manifestHash: string; releaseId: string },
          { batchIndex: number; verifiedArtifacts: number }
        >;
        verifyRelease: FunctionReference<
          "action",
          "internal",
          {
            manifestHash: string;
            releaseId: string;
            verifiedArtifacts: number;
          },
          null
        >;
      };
      workflow: {
        verifyRelease: FunctionReference<
          "mutation",
          "internal",
          {
            args?: { manifestHash: string; releaseId: string };
            context?: any;
            docs?: "To call a workflow directly, nest its arguments: { args: { ...yourWorkflowArgs } }";
            generationNumber?: number;
            onComplete?: string;
            startAsync?: boolean;
            workflowId?: string;
          },
          | string
          | {
              kind: "complete";
              runResult:
                | { kind: "success"; returnValue: null }
                | { error: string; kind: "failed" }
                | { kind: "canceled" };
            }
        >;
      };
    };
    recovery: {
      lookup: FunctionReference<
        "query",
        "internal",
        { recoveryId: string; releaseId: string },
        | { kind: "missing" }
        | {
            kind: "completed";
            value: {
              receipt: {
                activatedHeads: number;
                activeAppLocales: Array<"en" | "id" | "de">;
                deletedHeads: number;
                manifestHash: string;
                projectionDigest: string;
                releaseId: string;
                resultCount: number;
                resultDigest: string;
                routeDigest: string;
                snapshots: {
                  program: {
                    baseSnapshotId: string | null;
                    mode: "inherit" | "replace" | "restore";
                    resultSnapshotId: string | null;
                    rowCount: number;
                    rowDigest: string;
                  };
                  quran: {
                    baseSnapshotId: string | null;
                    mode: "inherit" | "replace" | "restore";
                    resultSnapshotId: string | null;
                    rowCount: number;
                    rowDigest: string;
                  };
                  tryout: {
                    baseSnapshotId: string | null;
                    mode: "inherit" | "replace" | "restore";
                    resultSnapshotId: string | null;
                    rowCount: number;
                    rowDigest: string;
                  };
                };
                stagedArtifacts: number;
                stagedItems: number;
                stagedProjections: number;
                stagedRoutes: number;
                stagedSnapshotRows: number;
              };
              releaseJson: string;
              rendererJson: string;
            };
          }
      >;
    };
    reference: {
      internal: {
        readAgentContent: FunctionReference<
          "query",
          "internal",
          {
            input:
              | { contentId: string; kind: "content" }
              | {
                  appLocale: "en" | "id" | "de";
                  kind: "route";
                  publicPath: string;
                };
          },
          | {
              kind: "reference";
              reference: {
                alignmentId: string;
                assetId: string;
                conceptId: string;
                content_id: string;
                description: string;
                learningObjectId: string;
                lensId: string;
                locale: "en" | "id" | "de";
                markdown_url?: string;
                route: string;
                section: "articles" | "material" | "tryout" | "quran";
                title: string;
                url: string;
              };
            }
          | {
              kind: "quran";
              markdown: {
                activeManifestHash: string | null;
                activeReleaseId: string | null;
                appLocale: "en" | "id" | "de";
                managed: boolean;
                preBismillah: {
                  arabic: string;
                  translation: {
                    notes: Array<{
                      number: number;
                      referenceOffset: number;
                      text: string;
                    }>;
                    segments: Array<
                      | { kind: "text"; offset: number; value: string }
                      | { kind: "note"; number: number; offset: number }
                    >;
                  };
                } | null;
                snapshotId: string | null;
                sourceOrigin:
                  | { kind: "git"; sha: string }
                  | { kind: "rollback"; releaseId: string }
                  | null;
                sourceRevision: string | null;
                sources:
                  | {
                      arabic: {
                        artifact: {
                          byteCount: number;
                          digest: string;
                          fileCount: number;
                        };
                        id: "tanzil-text";
                        kind: "embedded";
                        label: string;
                        notice: string;
                        publisher: string;
                        retrievedAt: string;
                        sourceUrl: string;
                        terms: {
                          artifact: {
                            byteCount: number;
                            digest: string;
                            fileCount: number;
                          };
                          url: string;
                        };
                        updateUrl: string;
                        version: string;
                      };
                      translation: {
                        artifact: {
                          byteCount: number;
                          digest: string;
                          fileCount: number;
                        };
                        id: "quranenc-english";
                        kind: "embedded";
                        label: string;
                        notice: string;
                        publisher: string;
                        retrievedAt: string;
                        sourceUrl: string;
                        terms: {
                          artifact: {
                            byteCount: number;
                            digest: string;
                            fileCount: number;
                          };
                          url: string;
                        };
                        updateUrl: string;
                        version: string;
                      };
                    }
                  | {
                      arabic: {
                        artifact: {
                          byteCount: number;
                          digest: string;
                          fileCount: number;
                        };
                        id: "tanzil-text";
                        kind: "embedded";
                        label: string;
                        notice: string;
                        publisher: string;
                        retrievedAt: string;
                        sourceUrl: string;
                        terms: {
                          artifact: {
                            byteCount: number;
                            digest: string;
                            fileCount: number;
                          };
                          url: string;
                        };
                        updateUrl: string;
                        version: string;
                      };
                      translation: {
                        artifact: {
                          byteCount: number;
                          digest: string;
                          fileCount: number;
                        };
                        id: "quranenc-indonesian";
                        kind: "embedded";
                        label: string;
                        notice: string;
                        publisher: string;
                        retrievedAt: string;
                        sourceUrl: string;
                        terms: {
                          artifact: {
                            byteCount: number;
                            digest: string;
                            fileCount: number;
                          };
                          url: string;
                        };
                        updateUrl: string;
                        version: string;
                      };
                    }
                  | {
                      arabic: {
                        artifact: {
                          byteCount: number;
                          digest: string;
                          fileCount: number;
                        };
                        id: "tanzil-text";
                        kind: "embedded";
                        label: string;
                        notice: string;
                        publisher: string;
                        retrievedAt: string;
                        sourceUrl: string;
                        terms: {
                          artifact: {
                            byteCount: number;
                            digest: string;
                            fileCount: number;
                          };
                          url: string;
                        };
                        updateUrl: string;
                        version: string;
                      };
                      translation: {
                        artifact: {
                          byteCount: number;
                          digest: string;
                          fileCount: number;
                        };
                        id: "quranenc-german";
                        kind: "embedded";
                        label: string;
                        notice: string;
                        publisher: string;
                        retrievedAt: string;
                        sourceUrl: string;
                        terms: {
                          artifact: {
                            byteCount: number;
                            digest: string;
                            fileCount: number;
                          };
                          url: string;
                        };
                        updateUrl: string;
                        version: string;
                      };
                    }
                  | null;
                surah: {
                  name: {
                    arabic: string;
                    sourceMeaning:
                      | { de: string; en: string; id: string }
                      | { appLocale: "en"; text: string };
                    transliteration: string;
                  };
                  number: number;
                  numberOfVerses: number;
                  revelation: { place: "Meccan" | "Medinan" };
                } | null;
                tafsirAccess:
                  | {
                      appLocale: "id";
                      kind: "embedded";
                      notice: string;
                      source: {
                        artifact: {
                          byteCount: number;
                          digest: string;
                          fileCount: number;
                        };
                        id: "quranenc-tafsir";
                        kind: "embedded";
                        label: string;
                        notice: string;
                        publisher: string;
                        retrievedAt: string;
                        sourceUrl: string;
                        terms: {
                          artifact: {
                            byteCount: number;
                            digest: string;
                            fileCount: number;
                          };
                          url: string;
                        };
                        updateUrl: string;
                        version: string;
                      };
                    }
                  | {
                      appLocale: "en";
                      kind: "external";
                      notice: string;
                      source: {
                        id: "mokhtasar-english";
                        kind: "external";
                        label: string;
                        notice: string;
                        publisher: string;
                        retrievedAt: string;
                        sourceUrl: string;
                        terms: { access: "link-only"; url: string };
                        updateUrl: string;
                        version: string;
                      };
                    }
                  | {
                      appLocale: "de";
                      kind: "external";
                      notice: string;
                      source: {
                        id: "mokhtasar-german";
                        kind: "external";
                        label: string;
                        notice: string;
                        publisher: string;
                        retrievedAt: string;
                        sourceUrl: string;
                        terms: { access: "link-only"; url: string };
                        updateUrl: string;
                        version: string;
                      };
                    }
                  | null;
                toVerse: number;
                verses: Array<{
                  arabic: string;
                  number: { inSurah: number };
                  translation: {
                    notes: Array<{
                      number: number;
                      referenceOffset: number;
                      text: string;
                    }>;
                    segments: Array<
                      | { kind: "text"; offset: number; value: string }
                      | { kind: "note"; number: number; offset: number }
                    >;
                  };
                }>;
              };
              reference: {
                alignmentId: string;
                assetId: string;
                conceptId: string;
                content_id: string;
                description: string;
                learningObjectId: string;
                lensId: string;
                locale: "en" | "id" | "de";
                markdown_url?: string;
                route: string;
                section: "articles" | "material" | "tryout" | "quran";
                title: string;
                url: string;
              };
              surahNumber: number;
            }
          | null
        >;
      };
    };
    rollback: {
      prepareRollback: FunctionReference<
        "query",
        "internal",
        {
          afterIndex: number;
          limit: number;
          rollbackOf: string;
          rollbackOfManifestHash: string;
        },
        string
      >;
      prepareRoutes: FunctionReference<
        "query",
        "internal",
        {
          afterIndex: number;
          limit: number;
          rollbackOf: string;
          rollbackOfManifestHash: string;
        },
        string
      >;
    };
    routes: {
      stageRouteBatch: FunctionReference<
        "mutation",
        "internal",
        { batchIndex: number; releaseId: string; routeJson: Array<string> },
        {
          batchIndex: number;
          created: number;
          releaseId: string;
          unchanged: number;
        }
      >;
    };
    runtime: {
      publication: {
        internal: {
          read: FunctionReference<
            "query",
            "internal",
            { appLocale: "en" | "id" | "de"; publicPath: string },
            null | {
              activeManifestHash: string;
              activeReleaseId: string;
              artifactJson: string;
              delivery: "public";
              projectionHash: string;
              projectionJson: string;
              releaseJson: string;
              rendererJson: string;
              sourcePath: string;
            }
          >;
          readBatch: FunctionReference<
            "query",
            "internal",
            {
              requests: Array<{
                appLocale: "en" | "id" | "de";
                publicPath: string;
              }>;
            },
            Array<null | {
              activeManifestHash: string;
              activeReleaseId: string;
              artifactJson: string;
              delivery: "public";
              projectionHash: string;
              projectionJson: string;
              releaseJson: string;
              rendererJson: string;
              sourcePath: string;
            }>
          >;
        };
      };
      tryout: {
        dispatch: {
          dispatch: FunctionReference<
            "action",
            "internal",
            { byteLength: number; source: string },
            { body: string; status: number }
          >;
        };
        internal: {
          read: FunctionReference<
            "query",
            "internal",
            {
              bundleHash: string;
              selectors: Array<{
                artifactHash: string;
                contentKey: string;
                delivery: "authenticated" | "entitled";
              }>;
              snapshotId: string;
            },
            null | {
              bundleJson: string;
              items: Array<{
                artifactJson: string;
                delivery: "authenticated" | "entitled";
                sourcePath: string;
              }>;
              rendererJson: string;
            }
          >;
        };
      };
    };
    snapshot: {
      batch: {
        stageSnapshotBatch: FunctionReference<
          "mutation",
          "internal",
          {
            batchIndex: number;
            family: "program" | "quran" | "tryout";
            releaseId: string;
            rowJson: Array<string>;
            snapshotId: string;
          },
          {
            batchIndex: number;
            created: number;
            family: "program" | "quran" | "tryout";
            releaseId: string;
            snapshotId: string;
            unchanged: number;
          }
        >;
      };
      manifest: {
        stageSnapshot: FunctionReference<
          "mutation",
          "internal",
          { releaseId: string; snapshotJson: string },
          {
            created: 0 | 1;
            family: "program" | "quran" | "tryout";
            releaseId: string;
            snapshotId: string;
            unchanged: 0 | 1;
          }
        >;
      };
      read: {
        manifest: FunctionReference<
          "query",
          "internal",
          { family: "program" | "quran" | "tryout"; releaseId: string },
          string
        >;
        rows: FunctionReference<
          "query",
          "internal",
          {
            afterBatchIndex: number;
            family: "program" | "quran" | "tryout";
            releaseId: string;
          },
          {
            batchIndex: number;
            done: boolean;
            firstIndex: number;
            nextBatchIndex: number;
            rowJson: Array<string>;
            snapshotId: string;
          }
        >;
      };
    };
    status: {
      current: FunctionReference<
        "query",
        "internal",
        {},
        {
          active: null | {
            receipt: {
              activatedHeads: number;
              activeAppLocales: Array<"en" | "id" | "de">;
              deletedHeads: number;
              manifestHash: string;
              projectionDigest: string;
              releaseId: string;
              resultCount: number;
              resultDigest: string;
              routeDigest: string;
              snapshots: {
                program: {
                  baseSnapshotId: string | null;
                  mode: "inherit" | "replace" | "restore";
                  resultSnapshotId: string | null;
                  rowCount: number;
                  rowDigest: string;
                };
                quran: {
                  baseSnapshotId: string | null;
                  mode: "inherit" | "replace" | "restore";
                  resultSnapshotId: string | null;
                  rowCount: number;
                  rowDigest: string;
                };
                tryout: {
                  baseSnapshotId: string | null;
                  mode: "inherit" | "replace" | "restore";
                  resultSnapshotId: string | null;
                  rowCount: number;
                  rowDigest: string;
                };
              };
              stagedArtifacts: number;
              stagedItems: number;
              stagedProjections: number;
              stagedRoutes: number;
              stagedSnapshotRows: number;
            };
            releaseJson: string;
            rendererJson: string;
          };
          candidate: null | {
            phase: "staging" | "verifying" | "verified" | "aborting";
            releaseJson: string;
            rendererJson: string;
          };
          recovery: null | {
            phase: "staging" | "verifying" | "verified" | "aborting";
            releaseJson: string;
            rendererJson: string;
          };
          tryoutRuntimeBundleJson: string | null;
        }
      >;
      getStatus: FunctionReference<
        "query",
        "internal",
        { manifestHash: string; releaseId: string },
        | {
            manifestHash: string;
            phase:
              | "missing"
              | "staging"
              | "verifying"
              | "verified"
              | "aborting"
              | "aborted";
            releaseId: string;
          }
        | {
            manifestHash: string;
            phase: "completed";
            receipt: {
              activatedHeads: number;
              activeAppLocales: Array<"en" | "id" | "de">;
              deletedHeads: number;
              manifestHash: string;
              projectionDigest: string;
              releaseId: string;
              resultCount: number;
              resultDigest: string;
              routeDigest: string;
              snapshots: {
                program: {
                  baseSnapshotId: string | null;
                  mode: "inherit" | "replace" | "restore";
                  resultSnapshotId: string | null;
                  rowCount: number;
                  rowDigest: string;
                };
                quran: {
                  baseSnapshotId: string | null;
                  mode: "inherit" | "replace" | "restore";
                  resultSnapshotId: string | null;
                  rowCount: number;
                  rowDigest: string;
                };
                tryout: {
                  baseSnapshotId: string | null;
                  mode: "inherit" | "replace" | "restore";
                  resultSnapshotId: string | null;
                  rowCount: number;
                  rowDigest: string;
                };
              };
              stagedArtifacts: number;
              stagedItems: number;
              stagedProjections: number;
              stagedRoutes: number;
              stagedSnapshotRows: number;
            };
            releaseId: string;
          }
      >;
    };
    verify: {
      verifyItems: FunctionReference<
        "mutation",
        "internal",
        { afterIndex: number; releaseId: string },
        { done: boolean; nextIndex: number; processed: number }
      >;
    };
  };
  contents: {
    mutations: {
      analytics: {
        processContentAnalyticsPartition: FunctionReference<
          "mutation",
          "internal",
          { leaseVersion: number; partition: number },
          {
            hasMore: boolean;
            partition: number;
            processed: number;
            skipped: boolean;
          }
        >;
        scheduleContentAnalyticsPartition: FunctionReference<
          "mutation",
          "internal",
          { partition: number },
          { createdPartition: boolean; scheduled: boolean }
        >;
        scheduleContentAnalyticsPartitions: FunctionReference<
          "mutation",
          "internal",
          {},
          { enqueuedPartitions: number }
        >;
      };
      popularity: {
        expireLearningPopularityWindowPage: FunctionReference<
          "mutation",
          "internal",
          {
            cursor?: string;
            day: number;
            scopeMode: "global";
            windowKey: "7d";
          },
          {
            continueCursor: string;
            expiredCounters: number;
            isDone: boolean;
            removedCounters: number;
            repairedCounters: number;
            skipped: boolean;
          }
        >;
        pruneLearningPopularity: FunctionReference<
          "mutation",
          "internal",
          {},
          {
            hasMore: boolean;
            signalsDeleted: number;
            viewersDeleted: number;
            waitingForMaintenance: boolean;
          }
        >;
        refreshLearningPopularityWindowPage: FunctionReference<
          "mutation",
          "internal",
          {
            cursor?: string;
            day: number;
            scopeMode: "global";
            windowKey: "7d";
          },
          {
            continueCursor: string;
            isDone: boolean;
            refreshedCounters: number;
            removedCounters: number;
            skipped: boolean;
          }
        >;
        scheduleLearningPopularityExpiries: FunctionReference<
          "mutation",
          "internal",
          {},
          {
            expiryWindows: number;
            repairWindows: number;
            skippedWindows: number;
          }
        >;
        scheduleLearningPopularityRefreshes: FunctionReference<
          "mutation",
          "internal",
          {},
          { scheduledWindows: number }
        >;
      };
    };
    sections: {
      build: {
        run: FunctionReference<
          "action",
          "internal",
          {
            position?:
              | { cursor: string | null; phase: "lessons" }
              | { phase: "quran"; surah: number }
              | { cursor: string | null; phase: "prune" };
            releaseId?: string;
          },
          {
            embedded: number;
            kept: number;
            missing: number;
            next: {
              position:
                | { cursor: string | null; phase: "lessons" }
                | { phase: "quran"; surah: number }
                | { cursor: string | null; phase: "prune" };
              releaseId: string;
            } | null;
            position:
              | { cursor: string | null; phase: "lessons" }
              | { phase: "quran"; surah: number }
              | { cursor: string | null; phase: "prune" };
            removed: number;
            skipped: number;
            stale: boolean;
            written: number;
          }
        >;
      };
      compare: {
        rank: FunctionReference<
          "action",
          "internal",
          {
            locale: "en" | "id" | "de";
            model:
              | "google/gemini-embedding-001"
              | "google/gemini-embedding-2"
              | "openai/text-embedding-3-large"
              | "openai/text-embedding-3-small"
              | "qwen/qwen3-embedding-4b"
              | "qwen/qwen3-embedding-8b";
            questions: Array<{
              contentKey: string;
              ordinal: number;
              question: string;
            }>;
          },
          | { kind: "empty" }
          | {
              kind: "ranked";
              pool: number;
              refused: number;
              verdicts: Array<{
                milliseconds: number;
                section: { heading: string; rank: number } | null;
              }>;
            }
          | {
              failure:
                | { _tag: "GatewayConfigurationError"; message: string }
                | {
                    _tag: "GatewayFailure";
                    reason:
                      | "rate-limit"
                      | "quota"
                      | "auth"
                      | "configuration"
                      | "invalid"
                      | "too-large"
                      | "timeout"
                      | "unavailable"
                      | "network"
                      | "interrupted"
                      | "unknown";
                    retryAfter?: number;
                    retryable?: boolean;
                    status?: number;
                    type?: string;
                  };
              kind: "failed";
            }
        >;
      };
      hits: {
        resolve: FunctionReference<
          "query",
          "internal",
          {
            ids: Array<Id<"contentSections">>;
            limit: number;
            locale: "en" | "id" | "de";
            query: string;
            section?: "articles" | "material" | "tryout" | "quran";
          },
          | { kind: "empty" }
          | {
              hits: Array<{
                anchor: string;
                appLocale: "en" | "id" | "de";
                contentKey: string;
                excerpt: string;
                headingPath: Array<string>;
                ordinal: number;
                reference: {
                  alignmentId: string;
                  assetId: string;
                  conceptId: string;
                  content_id: string;
                  description: string;
                  learningObjectId: string;
                  lensId: string;
                  locale: "en" | "id" | "de";
                  markdown_url?: string;
                  route: string;
                  section: "articles" | "material" | "tryout" | "quran";
                  title: string;
                  url: string;
                };
              }>;
              kind: "hits";
            }
        >;
      };
      rows: {
        finish: FunctionReference<
          "mutation",
          "internal",
          { model: string; releaseId: string },
          { recorded: boolean }
        >;
        lessons: FunctionReference<
          "query",
          "internal",
          { cursor: string | null; releaseId?: string },
          | { kind: "stale" }
          | {
              kind: "page";
              lessons: Array<{
                appLocale: "en" | "id" | "de";
                contentKey: string;
                publicPath: string;
                rawMdx: string;
                section: "articles" | "material" | "tryout" | "quran";
                title: string;
                version: string;
              }>;
              next: string | null;
              releaseId: string;
              unchanged: number;
            }
        >;
        page: FunctionReference<
          "query",
          "internal",
          { appLocale: "en" | "id" | "de"; cursor: string | null },
          {
            next: string | null;
            sections: Array<{
              contentKey: string;
              headingPath: Array<string>;
              ordinal: number;
              text: string;
            }>;
          }
        >;
        prune: FunctionReference<
          "mutation",
          "internal",
          { cursor: string | null; releaseId: string },
          {
            cursor: string | null;
            deleted: number;
            done: boolean;
            stale: boolean;
          }
        >;
        save: FunctionReference<
          "mutation",
          "internal",
          {
            model: string;
            releaseId: string;
            sections: Array<{
              anchor: string;
              appLocale: "en" | "id" | "de";
              contentKey: string;
              count: number;
              embedding?: Array<number>;
              excerpt: string;
              hash: string;
              headingPath: Array<string>;
              ordinal: number;
              publicPath: string;
              section: "articles" | "material" | "tryout" | "quran";
              text: string;
            }>;
            source: {
              appLocale: "en" | "id" | "de";
              contentKey: string;
              section: "articles" | "material" | "tryout" | "quran";
              version: string;
            };
          },
          {
            kept: number;
            missing: number;
            removed: number;
            stale: boolean;
            written: number;
          }
        >;
        stored: FunctionReference<
          "query",
          "internal",
          {
            appLocale: "en" | "id" | "de";
            contentKey: string;
            hashes: Array<string>;
            model: string;
          },
          Array<boolean>
        >;
        surah: FunctionReference<
          "query",
          "internal",
          { releaseId?: string; surah: number },
          | { kind: "stale" }
          | { kind: "done"; releaseId: string; unchanged: number }
          | {
              documents: Array<{
                appLocale: "en" | "id" | "de";
                contentKey: string;
                section: "articles" | "material" | "tryout" | "quran";
                sections: Array<{
                  anchor: string;
                  appLocale: "en" | "id" | "de";
                  contentKey: string;
                  count: number;
                  excerpt: string;
                  headingPath: Array<string>;
                  ordinal: number;
                  publicPath: string;
                  section: "articles" | "material" | "tryout" | "quran";
                  text: string;
                }>;
                version: string;
              }>;
              kind: "surah";
              releaseId: string;
              surah: number;
              unchanged: number;
            }
        >;
      };
      search: {
        search: FunctionReference<
          "action",
          "internal",
          {
            limit?: number;
            locale: "en" | "id" | "de";
            query: string;
            section?: "articles" | "material" | "tryout" | "quran";
          },
          | { kind: "empty" }
          | {
              hits: Array<{
                anchor: string;
                appLocale: "en" | "id" | "de";
                contentKey: string;
                excerpt: string;
                headingPath: Array<string>;
                ordinal: number;
                reference: {
                  alignmentId: string;
                  assetId: string;
                  conceptId: string;
                  content_id: string;
                  description: string;
                  learningObjectId: string;
                  lensId: string;
                  locale: "en" | "id" | "de";
                  markdown_url?: string;
                  route: string;
                  section: "articles" | "material" | "tryout" | "quran";
                  title: string;
                  url: string;
                };
              }>;
              kind: "hits";
            }
        >;
      };
      state: {
        ready: FunctionReference<"query", "internal", {}, boolean>;
      };
    };
  };
  credits: {
    mutations: {
      syncAllCreditResetPeriods: FunctionReference<
        "mutation",
        "internal",
        {},
        null
      >;
      syncCreditResetPeriod: FunctionReference<
        "mutation",
        "internal",
        { plan: "free" | "pro" },
        null
      >;
    };
  };
  editor: {
    deletion: {
      document: FunctionReference<
        "mutation",
        "internal",
        { documentId: Id<"editorDocuments"> },
        { done: boolean }
      >;
    };
    fold: {
      fold: FunctionReference<
        "mutation",
        "internal",
        { documentId: Id<"editorDocuments"> },
        { folded: number; skipped: number }
      >;
    };
    prune: {
      sweep: FunctionReference<
        "mutation",
        "internal",
        { cursor: string | null },
        { deleted: number; done: boolean; scanned: number }
      >;
    };
  };
  emails: {
    invite: {
      delivery: {
        render: FunctionReference<
          "action",
          "internal",
          {
            locale: "en" | "id" | "de";
            organisation: string;
            privacyPolicyUrl: string;
            signInUrl: string;
            termsOfServiceUrl: string;
          },
          { html: string; subject: string; text: string }
        >;
      };
      internal: {
        enqueueRendered: FunctionReference<
          "mutation",
          "internal",
          {
            html: string;
            inviteId: Id<"tenantInvites">;
            requestedAt: number;
            subject: string;
            text: string;
          },
          null
        >;
        readInput: FunctionReference<
          "query",
          "internal",
          { inviteId: Id<"tenantInvites">; locale: "en" | "id" | "de" },
          {
            locale: "en" | "id" | "de";
            organisation: string;
            privacyPolicyUrl: string;
            signInUrl: string;
            termsOfServiceUrl: string;
          } | null
        >;
      };
      workflow: {
        deliverInviteEmail: FunctionReference<
          "mutation",
          "internal",
          {
            args?: {
              inviteId: Id<"tenantInvites">;
              locale: "en" | "id" | "de";
              requestedAt: number;
            };
            context?: any;
            docs?: "To call a workflow directly, nest its arguments: { args: { ...yourWorkflowArgs } }";
            generationNumber?: number;
            onComplete?: string;
            startAsync?: boolean;
            workflowId?: string;
          },
          | string
          | {
              kind: "complete";
              runResult:
                | { kind: "success"; returnValue: null }
                | { error: string; kind: "failed" }
                | { kind: "canceled" };
            }
        >;
        finishInviteEmail: FunctionReference<
          "mutation",
          "internal",
          {
            context: { inviteId: Id<"tenantInvites"> };
            result:
              | { kind: "success"; returnValue: any }
              | { error: string; kind: "failed" }
              | { kind: "canceled" };
            workflowId: string;
          },
          null
        >;
      };
    };
    retention: {
      cleanupRetainedEmailData: FunctionReference<
        "mutation",
        "internal",
        {},
        null
      >;
    };
    welcome: {
      delivery: {
        sendWelcomeEmail: FunctionReference<
          "action",
          "internal",
          { intentId: Id<"welcomeEmailIntents"> },
          null
        >;
      };
      internal: {
        enqueueRenderedWelcome: FunctionReference<
          "mutation",
          "internal",
          {
            html: string;
            intentId: Id<"welcomeEmailIntents">;
            subject: string;
            text: string;
          },
          null
        >;
        readIntentInput: FunctionReference<
          "query",
          "internal",
          { intentId: Id<"welcomeEmailIntents"> },
          null | {
            continueUrl: string;
            locale: "en" | "id" | "de";
            privacyPolicyUrl: string;
            termsOfServiceUrl: string;
          }
        >;
      };
      reconciliation: {
        reconcileWelcomeIntentLifecycle: FunctionReference<
          "mutation",
          "internal",
          { cursor: null | string; phase: "scheduled" | "enqueued" },
          null
        >;
      };
      workflow: {
        deliverWelcomeEmail: FunctionReference<
          "mutation",
          "internal",
          {
            args?: { intentId: Id<"welcomeEmailIntents"> };
            context?: any;
            docs?: "To call a workflow directly, nest its arguments: { args: { ...yourWorkflowArgs } }";
            generationNumber?: number;
            onComplete?: string;
            startAsync?: boolean;
            workflowId?: string;
          },
          | string
          | {
              kind: "complete";
              runResult:
                | { kind: "success"; returnValue: null }
                | { error: string; kind: "failed" }
                | { kind: "canceled" };
            }
        >;
      };
    };
  };
  exams: {
    assets: {
      commit: FunctionReference<
        "mutation",
        "internal",
        {
          byteSize: number;
          contentType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
          examId: Id<"exams">;
          height: number;
          storageId: Id<"_storage">;
          userId: Id<"users">;
          width: number;
        },
        { id: Id<"examAssets"> }
      >;
      discard: FunctionReference<
        "mutation",
        "internal",
        { storageId: Id<"_storage"> },
        {}
      >;
      stored: FunctionReference<
        "query",
        "internal",
        { storageId: Id<"_storage"> },
        { size: number }
      >;
    };
    seed: {
      sitting: FunctionReference<
        "mutation",
        "internal",
        { crowd?: number; email: string; slug: string; upcoming?: boolean },
        {
          examId: Id<"exams">;
          sittingId: Id<"examSittings">;
          title: string;
          token: string;
        }
      >;
    };
    sittings: {
      timers: {
        closeAttempt: FunctionReference<
          "mutation",
          "internal",
          { attemptId: Id<"examAttempts"> },
          null
        >;
        closeDue: FunctionReference<
          "mutation",
          "internal",
          { atDeadline: "closesAt" | "now"; sittingId: Id<"examSittings"> },
          null
        >;
        open: FunctionReference<
          "mutation",
          "internal",
          { sittingId: Id<"examSittings"> },
          null
        >;
        submit: FunctionReference<
          "mutation",
          "internal",
          { attemptId: Id<"examAttempts"> },
          null
        >;
      };
    };
  };
  identity: {
    logins: {
      usernameOf: FunctionReference<
        "query",
        "internal",
        { loginName: string; slug: string },
        { outcome: "found"; username: string } | { outcome: "missing" }
      >;
    };
    seed: {
      card: FunctionReference<
        "mutation",
        "internal",
        { slug: string },
        { code: string; loginName: string }
      >;
    };
  };
  nina: {
    brief: {
      read: FunctionReference<
        "query",
        "internal",
        {
          chatId: Id<"chats">;
          now: number;
          order: number;
          promptMessageId: string;
          topics: Array<string>;
          userId: Id<"users">;
        },
        {
          learner: {
            paused: boolean;
            portrait?: string;
            profile: {
              focus?: "learning" | "tryout";
              region?:
                | "indonesia"
                | "singapore"
                | "united-kingdom"
                | "germany"
                | "united-states"
                | "international";
              tryout?: {
                correct: number;
                exam: string;
                finishedAt: number;
                score: number;
                sections: Array<{
                  correct: number;
                  key: string;
                  total: number;
                }>;
                set: string;
                status: "provisional" | "official";
                total: number;
              };
              tryoutCountry?: string;
            };
            recalled: Array<{
              confirmedAt: number;
              id: Id<"ninaMemories">;
              kind?: "level" | "goal" | "style" | "struggle" | "situation";
              text: string;
              title?: string;
            }>;
          };
          summary: { text: string; throughOrder: number } | null;
          uncovered: Array<{ order: number; retryOf?: number }>;
        }
      >;
    };
    documents: {
      run: FunctionReference<
        "action",
        "internal",
        { turnId: Id<"ninaTurns"> },
        null
      >;
    };
    focus: {
      read: FunctionReference<
        "query",
        "internal",
        { turnId: Id<"ninaTurns"> },
        {
          explanationMdx: string;
          outcome:
            | { status: "correct" }
            | { status: "incorrect" }
            | { points: number; status: "partial" }
            | { status: "pending" }
            | null;
          questionLocale: "en" | "id" | "de";
          questionMdx: string;
          questionOrder: number;
          responseSpec:
            | {
                kind: "single-choice";
                options: Array<{
                  isCorrect: boolean;
                  label: string;
                  optionKey: string;
                  order: number;
                }>;
              }
            | {
                kind: "multiple-choice";
                options: Array<{
                  isCorrect: boolean;
                  label: string;
                  optionKey: string;
                  order: number;
                }>;
              }
            | {
                categories: Array<{
                  categoryKey: string;
                  label: string;
                  order: number;
                }>;
                kind: "category";
                statements: Array<{
                  correctCategoryKey: string;
                  label: string;
                  order: number;
                  statementKey: string;
                }>;
              }
            | {
                key:
                  | {
                      acceptsFractions: boolean;
                      kind: "number";
                      tolerance?: {
                        kind: "absolute" | "relative";
                        value: string;
                      };
                      value: string;
                    }
                  | {
                      acceptedAnswers: Array<string>;
                      collapseWhitespace: boolean;
                      ignoreCase: boolean;
                      kind: "text";
                    };
                kind: "short-answer";
                language: "en" | "id" | "de";
              }
            | {
                criteria: Array<{
                  criterionKey: string;
                  finalAnswer?:
                    | {
                        acceptsFractions: boolean;
                        kind: "number";
                        tolerance?: {
                          kind: "absolute" | "relative";
                          value: string;
                        };
                        value: string;
                      }
                    | {
                        acceptedAnswers: Array<string>;
                        collapseWhitespace: boolean;
                        ignoreCase: boolean;
                        kind: "text";
                      };
                  label: { de: string; en: string; id: string };
                  levels: Array<{
                    label: { de: string; en: string; id: string };
                    levelKey: string;
                    order: number;
                    points: number;
                  }>;
                  order: number;
                }>;
                kind: "rubric";
                language: "en" | "id" | "de";
              };
          selection:
            | { kind: "single-choice"; optionKey: string }
            | { kind: "multiple-choice"; optionKeys: Array<string> }
            | {
                assignments: Array<{
                  categoryKey: string;
                  statementKey: string;
                }>;
                kind: "category";
              }
            | { kind: "short-answer"; number?: string; text: string }
            | {
                finalAnswers: Array<{
                  criterionKey: string;
                  number?: string;
                  text: string;
                }>;
                kind: "rubric";
                text: string;
              }
            | null;
        } | null
      >;
    };
    judgment: {
      measure: FunctionReference<
        "action",
        "internal",
        {
          names: Array<"lasting" | "ownNote" | "private">;
          texts: Array<string>;
        },
        | {
            judgments: Record<
              string,
              { instructions: string; threshold: number }
            >;
            kind: "measured";
            rows: Array<
              | { probabilities: Record<string, number> }
              | { failure: { reason: string; status?: number; type?: string } }
            >;
          }
        | {
            failure: { _tag: "GatewayConfigurationError"; message: string };
            kind: "failed";
          }
      >;
    };
    lifecycle: {
      abandon: FunctionReference<
        "mutation",
        "internal",
        { turnId: Id<"ninaTurns"> },
        null
      >;
      claim: FunctionReference<
        "mutation",
        "internal",
        { turnId: Id<"ninaTurns"> },
        | {
            _creationTime: number;
            _id: Id<"ninaTurns">;
            cancelRequestedAt?: number;
            chatId: Id<"chats">;
            credits: number;
            creditsResetAt: number;
            fingerprint: string;
            history?: { tokens: number; turns: number; unread?: number };
            order: number;
            page: {
              locale: "en" | "id" | "de";
              needsFetch: boolean;
              nina: {
                focus?: {
                  attemptId: Id<"tryoutAttempts">;
                  kind: "tryout-question";
                  placementId: Id<"tryoutAttemptPlacements">;
                  questionOrder: number;
                  sectionKey: string;
                };
                learning: {
                  assetId?: string;
                  locale: "en" | "id" | "de";
                  materialKey?: string;
                  section?: string;
                  slug: string;
                  sourcePath?: string;
                  title?: string;
                  url: string;
                  verified: boolean;
                };
                placement?: {
                  mode: "placement";
                  nodeKey: string;
                  parentHref: string;
                  parentTitle: string;
                  programKey: string;
                };
                tools: {
                  allowPageFetch: boolean;
                  evidenceScope: "verified-page" | "general-learning";
                };
              };
              slug: string;
            };
            phase: "active";
            planCreditGrantId?: Id<"creditTransactions">;
            promptMessageId: string;
            promptedAt?: number;
            remembered?: number;
            requestId: string;
            retryOf?: number;
            state:
              { status: "queued" } | { startedAt: number; status: "running" };
            suggestions?: Array<string>;
            threadId: string;
            timing?: {
              claimedMs?: number;
              progressMs?: number;
              readyMs?: number;
              tokenMs?: number;
            };
            tokens?: { input?: number; output?: number; total?: number };
            transactionId: Id<"creditTransactions">;
            usage: Array<{
              agent:
                | "nina"
                | "nakafa"
                | "research"
                | "math"
                | "math-repair"
                | "suggestions"
                | "title"
                | "nina-repair"
                | "memory";
              cached?: number;
              calls: number;
              cost?: number;
              input: number;
              model: string;
              output: number;
              provider: string;
              reasoning?: number;
            }>;
            user: {
              curriculumPreference?: {
                program: { key: string; title: string };
              };
              role?: "teacher" | "student" | "parent" | "administrator";
            };
            userId: Id<"users">;
          }
        | {
            _creationTime: number;
            _id: Id<"ninaTurns">;
            chatId: Id<"chats">;
            credits?: number;
            fingerprint?: string;
            history?: { tokens: number; turns: number; unread?: number };
            order: number;
            page?: {
              locale: "en" | "id" | "de";
              needsFetch: boolean;
              nina: {
                focus?: {
                  attemptId: Id<"tryoutAttempts">;
                  kind: "tryout-question";
                  placementId: Id<"tryoutAttemptPlacements">;
                  questionOrder: number;
                  sectionKey: string;
                };
                learning: {
                  assetId?: string;
                  locale: "en" | "id" | "de";
                  materialKey?: string;
                  section?: string;
                  slug: string;
                  sourcePath?: string;
                  title?: string;
                  url: string;
                  verified: boolean;
                };
                placement?: {
                  mode: "placement";
                  nodeKey: string;
                  parentHref: string;
                  parentTitle: string;
                  programKey: string;
                };
                tools: {
                  allowPageFetch: boolean;
                  evidenceScope: "verified-page" | "general-learning";
                };
              };
              slug: string;
            };
            phase: "settled";
            promptMessageId: string;
            promptedAt?: number;
            remembered?: number;
            requestId?: string;
            retryOf?: number;
            sealAttempts?: number;
            sealFailedAt?: number;
            sealHold?:
              | "accountDeleted"
              | "chatDeleted"
              | "failedAttempts"
              | "promptMissing";
            sealedAt?: number;
            state:
              | { finishedAt: number; status: "complete" }
              | {
                  finishedAt: number;
                  reason?:
                    | "provider-busy"
                    | "provider-unavailable"
                    | "service-configuration"
                    | "request-rejected"
                    | "input-too-large"
                    | "response-timeout"
                    | "content-blocked"
                    | "response-limit"
                    | "interrupted"
                    | "unknown";
                  status: "failed";
                }
              | { finishedAt: number; status: "cancelled" };
            suggestions?: Array<string>;
            threadId: string;
            timing?: {
              claimedMs?: number;
              progressMs?: number;
              readyMs?: number;
              tokenMs?: number;
            };
            tokens?: { input?: number; output?: number; total?: number };
            transactionId?: Id<"creditTransactions">;
            usage: Array<{
              agent:
                | "nina"
                | "nakafa"
                | "research"
                | "math"
                | "math-repair"
                | "suggestions"
                | "title"
                | "nina-repair"
                | "memory";
              cached?: number;
              calls: number;
              cost?: number;
              input: number;
              model: string;
              output: number;
              provider: string;
              reasoning?: number;
            }>;
            user?: {
              curriculumPreference?: {
                program: { key: string; title: string };
              };
              role?: "teacher" | "student" | "parent" | "administrator";
            };
            userId: Id<"users">;
          }
        | null
      >;
      expire: FunctionReference<
        "mutation",
        "internal",
        { turnId: Id<"ninaTurns"> },
        null
      >;
      presentation: FunctionReference<
        "query",
        "internal",
        { turnId: Id<"ninaTurns"> },
        | {
            _creationTime: number;
            _id: Id<"ninaTurns">;
            cancelRequestedAt?: number;
            chatId: Id<"chats">;
            credits: number;
            creditsResetAt: number;
            fingerprint: string;
            history?: { tokens: number; turns: number; unread?: number };
            order: number;
            page: {
              locale: "en" | "id" | "de";
              needsFetch: boolean;
              nina: {
                focus?: {
                  attemptId: Id<"tryoutAttempts">;
                  kind: "tryout-question";
                  placementId: Id<"tryoutAttemptPlacements">;
                  questionOrder: number;
                  sectionKey: string;
                };
                learning: {
                  assetId?: string;
                  locale: "en" | "id" | "de";
                  materialKey?: string;
                  section?: string;
                  slug: string;
                  sourcePath?: string;
                  title?: string;
                  url: string;
                  verified: boolean;
                };
                placement?: {
                  mode: "placement";
                  nodeKey: string;
                  parentHref: string;
                  parentTitle: string;
                  programKey: string;
                };
                tools: {
                  allowPageFetch: boolean;
                  evidenceScope: "verified-page" | "general-learning";
                };
              };
              slug: string;
            };
            phase: "active";
            planCreditGrantId?: Id<"creditTransactions">;
            promptMessageId: string;
            promptedAt?: number;
            remembered?: number;
            requestId: string;
            retryOf?: number;
            state:
              { status: "queued" } | { startedAt: number; status: "running" };
            suggestions?: Array<string>;
            threadId: string;
            timing?: {
              claimedMs?: number;
              progressMs?: number;
              readyMs?: number;
              tokenMs?: number;
            };
            tokens?: { input?: number; output?: number; total?: number };
            transactionId: Id<"creditTransactions">;
            usage: Array<{
              agent:
                | "nina"
                | "nakafa"
                | "research"
                | "math"
                | "math-repair"
                | "suggestions"
                | "title"
                | "nina-repair"
                | "memory";
              cached?: number;
              calls: number;
              cost?: number;
              input: number;
              model: string;
              output: number;
              provider: string;
              reasoning?: number;
            }>;
            user: {
              curriculumPreference?: {
                program: { key: string; title: string };
              };
              role?: "teacher" | "student" | "parent" | "administrator";
            };
            userId: Id<"users">;
          }
        | {
            _creationTime: number;
            _id: Id<"ninaTurns">;
            chatId: Id<"chats">;
            credits?: number;
            fingerprint?: string;
            history?: { tokens: number; turns: number; unread?: number };
            order: number;
            page?: {
              locale: "en" | "id" | "de";
              needsFetch: boolean;
              nina: {
                focus?: {
                  attemptId: Id<"tryoutAttempts">;
                  kind: "tryout-question";
                  placementId: Id<"tryoutAttemptPlacements">;
                  questionOrder: number;
                  sectionKey: string;
                };
                learning: {
                  assetId?: string;
                  locale: "en" | "id" | "de";
                  materialKey?: string;
                  section?: string;
                  slug: string;
                  sourcePath?: string;
                  title?: string;
                  url: string;
                  verified: boolean;
                };
                placement?: {
                  mode: "placement";
                  nodeKey: string;
                  parentHref: string;
                  parentTitle: string;
                  programKey: string;
                };
                tools: {
                  allowPageFetch: boolean;
                  evidenceScope: "verified-page" | "general-learning";
                };
              };
              slug: string;
            };
            phase: "settled";
            promptMessageId: string;
            promptedAt?: number;
            remembered?: number;
            requestId?: string;
            retryOf?: number;
            sealAttempts?: number;
            sealFailedAt?: number;
            sealHold?:
              | "accountDeleted"
              | "chatDeleted"
              | "failedAttempts"
              | "promptMissing";
            sealedAt?: number;
            state:
              | { finishedAt: number; status: "complete" }
              | {
                  finishedAt: number;
                  reason?:
                    | "provider-busy"
                    | "provider-unavailable"
                    | "service-configuration"
                    | "request-rejected"
                    | "input-too-large"
                    | "response-timeout"
                    | "content-blocked"
                    | "response-limit"
                    | "interrupted"
                    | "unknown";
                  status: "failed";
                }
              | { finishedAt: number; status: "cancelled" };
            suggestions?: Array<string>;
            threadId: string;
            timing?: {
              claimedMs?: number;
              progressMs?: number;
              readyMs?: number;
              tokenMs?: number;
            };
            tokens?: { input?: number; output?: number; total?: number };
            transactionId?: Id<"creditTransactions">;
            usage: Array<{
              agent:
                | "nina"
                | "nakafa"
                | "research"
                | "math"
                | "math-repair"
                | "suggestions"
                | "title"
                | "nina-repair"
                | "memory";
              cached?: number;
              calls: number;
              cost?: number;
              input: number;
              model: string;
              output: number;
              provider: string;
              reasoning?: number;
            }>;
            user?: {
              curriculumPreference?: {
                program: { key: string; title: string };
              };
              role?: "teacher" | "student" | "parent" | "administrator";
            };
            userId: Id<"users">;
          }
        | null
      >;
      recover: FunctionReference<
        "mutation",
        "internal",
        {
          failure?:
            | "provider-busy"
            | "provider-unavailable"
            | "service-configuration"
            | "request-rejected"
            | "input-too-large"
            | "response-timeout"
            | "content-blocked"
            | "response-limit"
            | "interrupted"
            | "unknown";
          history?: { tokens: number; turns: number; unread?: number };
          timing?: {
            claimedMs?: number;
            progressMs?: number;
            readyMs?: number;
            tokenMs?: number;
          };
          turnId: Id<"ninaTurns">;
        },
        null
      >;
      sweep: FunctionReference<
        "mutation",
        "internal",
        { resume?: { before: number; cursor: string } },
        null
      >;
    };
    memory: {
      capture: FunctionReference<
        "mutation",
        "internal",
        {
          candidates: Array<
            | {
                kind: "situation";
                known?: number;
                quote: string;
                text: string;
                until: string;
              }
            | {
                kind: "level" | "goal" | "style" | "struggle";
                known?: number;
                quote: string;
                text: string;
              }
          >;
          seen: Array<{ confirmedAt: number; id: Id<"ninaMemories"> }>;
          topics: Array<string>;
          turnId: Id<"ninaTurns">;
          userId: Id<"users">;
        },
        number
      >;
      drain: FunctionReference<
        "mutation",
        "internal",
        { through: number; userId: Id<"users"> },
        number
      >;
      expire: FunctionReference<"mutation", "internal", {}, number>;
      known: FunctionReference<
        "query",
        "internal",
        {
          message: string;
          now: number;
          topics: Array<string>;
          userId: Id<"users">;
        },
        {
          known: Array<{
            confirmedAt: number;
            id: Id<"ninaMemories">;
            kind?: "level" | "goal" | "style" | "struggle" | "situation";
            text: string;
            title?: string;
          }>;
          profile: {
            focus?: "learning" | "tryout";
            region?:
              | "indonesia"
              | "singapore"
              | "united-kingdom"
              | "germany"
              | "united-states"
              | "international";
            tryout?: {
              correct: number;
              exam: string;
              finishedAt: number;
              score: number;
              sections: Array<{ correct: number; key: string; total: number }>;
              set: string;
              status: "provisional" | "official";
              total: number;
            };
            tryoutCountry?: string;
          };
        }
      >;
      lookup: FunctionReference<
        "query",
        "internal",
        { now: number; query: string; userId: Id<"users"> },
        {
          memories: Array<{
            confirmedAt: number;
            id: Id<"ninaMemories">;
            kind?: "level" | "goal" | "style" | "struggle" | "situation";
            text: string;
            title?: string;
          }>;
          paused: boolean;
        }
      >;
      paused: FunctionReference<
        "query",
        "internal",
        { userId: Id<"users"> },
        boolean
      >;
      purge: FunctionReference<
        "mutation",
        "internal",
        { id: Id<"ninaMemoryRestores"> },
        null
      >;
    };
    phase: {
      halted: FunctionReference<
        "query",
        "internal",
        { turnId: Id<"ninaTurns"> },
        boolean
      >;
    };
    portrait: {
      build: {
        run: FunctionReference<
          "action",
          "internal",
          { userId: Id<"users"> },
          null
        >;
      };
      claim: FunctionReference<
        "mutation",
        "internal",
        { userId: Id<"users"> },
        {
          memories: Array<{
            confirmedAt: number;
            id: Id<"ninaMemories">;
            kind?: "level" | "goal" | "style" | "struggle" | "situation";
            text: string;
            title?: string;
          }>;
          more: boolean;
          portrait?: string;
          reached: number;
          through: number;
        } | null
      >;
      save: FunctionReference<
        "mutation",
        "internal",
        {
          expected: number;
          memories: Array<{ confirmedAt: number; id: Id<"ninaMemories"> }>;
          more: boolean;
          reached: number;
          text?: string;
          usage?: { input: number; output: number };
          userId: Id<"users">;
        },
        boolean
      >;
    };
    presentation: {
      save: FunctionReference<
        "mutation",
        "internal",
        {
          suggestions?: Array<string>;
          title?: string;
          turnId: Id<"ninaTurns">;
        },
        null
      >;
    };
    response: {
      present: FunctionReference<
        "action",
        "internal",
        { turnId: Id<"ninaTurns"> },
        null
      >;
      run: FunctionReference<
        "action",
        "internal",
        { turnId: Id<"ninaTurns"> },
        null
      >;
    };
    sealed: {
      candidates: FunctionReference<
        "query",
        "internal",
        { cursor: string | null; numItems: number },
        { continueCursor: string; ids: Array<Id<"ninaTurns">>; isDone: boolean }
      >;
      drain: FunctionReference<"action", "internal", { budget: number }, null>;
      message: FunctionReference<
        "query",
        "internal",
        { messageId: string; owner: Id<"users"> },
        any | null
      >;
      recordFailure: FunctionReference<
        "mutation",
        "internal",
        { turnId: Id<"ninaTurns"> },
        { attempts: number; held: boolean } | null
      >;
      seal: FunctionReference<
        "mutation",
        "internal",
        { turnId: Id<"ninaTurns"> },
        { bytes: number }
      >;
      thread: FunctionReference<
        "query",
        "internal",
        {
          excludeToolMessages?: boolean;
          owner: Id<"users">;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          statuses?: Array<"failed" | "pending" | "success">;
          threadId: string;
          upToAndIncludingMessageId?: string;
        },
        { continueCursor: string; isDone: boolean; page: Array<any> }
      >;
    };
    summaries: {
      anchor: FunctionReference<
        "query",
        "internal",
        { chatId: Id<"chats">; order: number },
        string | null
      >;
      asked: FunctionReference<
        "query",
        "internal",
        { before: number; chatId: Id<"chats">; questions: Array<number> },
        Array<{ order: number; retryOf?: number }>
      >;
      read: FunctionReference<
        "query",
        "internal",
        { chatId: Id<"chats"> },
        { text: string; throughOrder: number } | null
      >;
      save: FunctionReference<
        "mutation",
        "internal",
        {
          chatId: Id<"chats">;
          text?: string;
          throughOrder: number;
          usage: { input: number; output: number };
        },
        null
      >;
      uncovered: FunctionReference<
        "query",
        "internal",
        { before: number; chatId: Id<"chats">; through: number | null },
        Array<{ order: number; retryOf?: number }>
      >;
    };
    uploads: {
      complete: FunctionReference<
        "mutation",
        "internal",
        { fileId: string; uploadId: Id<"ninaUploads"> },
        null
      >;
      discard: FunctionReference<
        "mutation",
        "internal",
        { uploadId: Id<"ninaUploads"> },
        null
      >;
      reserve: FunctionReference<
        "mutation",
        "internal",
        { filename: string },
        { storedFilename: string; uploadId: Id<"ninaUploads"> }
      >;
    };
    usage: {
      record: FunctionReference<
        "mutation",
        "internal",
        {
          turnId: Id<"ninaTurns">;
          usage: {
            agent:
              | "nina"
              | "nakafa"
              | "research"
              | "math"
              | "math-repair"
              | "suggestions"
              | "title"
              | "nina-repair"
              | "memory";
            cached?: number;
            cost?: number;
            input: number;
            model: string;
            output: number;
            provider: string;
            reasoning?: number;
          };
        },
        null
      >;
    };
    waits: {
      summary: FunctionReference<
        "query",
        "internal",
        { count: number },
        {
          newest?: number;
          oldest?: number;
          read: number;
          statuses: {
            cancelled: number;
            complete: number;
            failed: number;
            open: number;
          };
          waits: Array<{
            max?: number;
            median?: number;
            min?: number;
            p90?: number;
            stage: "claimedMs" | "readyMs" | "progressMs" | "tokenMs";
            turns: number;
          }>;
        }
      >;
    };
  };
  notifications: {
    consume: {
      run: FunctionReference<
        "mutation",
        "internal",
        { tenantId: Id<"tenants"> },
        null
      >;
      sweep: FunctionReference<"mutation", "internal", {}, null>;
    };
    purge: {
      run: FunctionReference<
        "mutation",
        "internal",
        { personId: Id<"tenantPeople"> },
        null
      >;
    };
    read: {
      run: FunctionReference<
        "mutation",
        "internal",
        { cursor: string | null; personId: Id<"tenantPeople">; readAt: number },
        null
      >;
    };
  };
  operators: {
    expiry: {
      sweep: FunctionReference<"mutation", "internal", {}, null>;
      visit: FunctionReference<
        "mutation",
        "internal",
        { visitId: Id<"tenantVisits"> },
        null
      >;
    };
    staff: {
      grant: FunctionReference<
        "mutation",
        "internal",
        { userId: Id<"users"> },
        {
          changedAt: number;
          grantedAt: number;
          id: Id<"operators">;
          status: "active" | "revoked";
          userId: Id<"users">;
        }
      >;
      revoke: FunctionReference<
        "mutation",
        "internal",
        { userId: Id<"users"> },
        {
          changedAt: number;
          grantedAt: number;
          id: Id<"operators">;
          status: "active" | "revoked";
          userId: Id<"users">;
        }
      >;
    };
  };
  posts: {
    cleanup: {
      cleanupDeletedPost: FunctionReference<
        "mutation",
        "internal",
        { postId: Id<"posts"> },
        null
      >;
    };
  };
  privacy: {
    recovery: {
      cleanupWorkflowStorage: FunctionReference<
        "mutation",
        "internal",
        { source: "account-deletion" | "consent-overlap"; workflowId: string },
        null
      >;
      handleCleanupComplete: FunctionReference<
        "mutation",
        "internal",
        {
          context: { source: "account-deletion" | "consent-overlap" };
          result:
            | { kind: "success"; returnValue: any }
            | { error: string; kind: "failed" }
            | { kind: "canceled" };
          workflowId: string;
        },
        null
      >;
      retryCleanupWorkflow: FunctionReference<
        "mutation",
        "internal",
        { source: "account-deletion" | "consent-overlap"; workflowId: string },
        null
      >;
    };
  };
  routes: {
    agent: {
      quota: {
        consume: FunctionReference<
          "mutation",
          "internal",
          { key: string },
          null
        >;
      };
    };
  };
  storage: {
    sweep: FunctionReference<
      "mutation",
      "internal",
      {},
      { deleted: number; done: boolean; scanned: number }
    >;
  };
  tenancy: {
    claims: {
      run: FunctionReference<
        "mutation",
        "internal",
        { cursor: string | null; userId: Id<"users"> },
        null
      >;
    };
    expiry: {
      invite: FunctionReference<
        "mutation",
        "internal",
        { inviteId: Id<"tenantInvites"> },
        null
      >;
      sweep: FunctionReference<"mutation", "internal", {}, null>;
    };
    holders: {
      schedule: FunctionReference<
        "mutation",
        "internal",
        { cursor: string | null; email: string },
        null
      >;
    };
    promotion: {
      run: {
        run: FunctionReference<
          "mutation",
          "internal",
          { actorId: Id<"tenantPeople">; promotionId: Id<"tenantPromotions"> },
          null
        >;
      };
    };
    provision: {
      invite: FunctionReference<
        "mutation",
        "internal",
        {
          email: string;
          locale: "en" | "id" | "de";
          name: string;
          slug: string;
        },
        { invite: Id<"tenantInvites">; person: Id<"tenantPeople"> }
      >;
      open: FunctionReference<
        "mutation",
        "internal",
        {
          contract: {
            contentLicense: string;
            dpaVersion: string;
            modules: Array<"classes" | "exams" | "bank" | "grades" | "reports">;
            plan: "tenant" | "unit";
          };
          country: string;
          currency: string;
          kind: "school" | "foundation";
          name: string;
          owner: { email: string; name: string };
          slug: string;
          units: Array<{
            contentLanguage: "en" | "id" | "de";
            level:
              | "paud"
              | "sd"
              | "mi"
              | "smp"
              | "mts"
              | "sma"
              | "ma"
              | "smk"
              | "slb"
              | "other";
            name: string;
            npsn?: string;
            timeZone: string;
          }>;
        },
        {
          invite: Id<"tenantInvites">;
          owner: Id<"tenantPeople">;
          tenant: Id<"tenants">;
          units: Array<Id<"tenantUnits">>;
        }
      >;
    };
    seed: {
      student: FunctionReference<
        "mutation",
        "internal",
        { email: string; slug: string },
        null
      >;
      teacher: FunctionReference<
        "mutation",
        "internal",
        {
          email: string;
          locale: "en" | "id" | "de";
          name: string;
          slug: string;
        },
        { invite: Id<"tenantInvites">; person: Id<"tenantPeople"> }
      >;
    };
  };
  triggers: {
    chats: {
      cleanup: {
        cleanupDeletedChat: FunctionReference<
          "mutation",
          "internal",
          { chatId: Id<"chats"> },
          null
        >;
      };
    };
    comments: {
      cleanup: {
        cleanupDeletedComment: FunctionReference<
          "mutation",
          "internal",
          { commentId: Id<"comments"> },
          null
        >;
      };
    };
  };
  tryouts: {
    mutations: {
      expiry: {
        attempt: FunctionReference<
          "mutation",
          "internal",
          { attemptId: Id<"tryoutAttempts">; expiresAt: number },
          null
        >;
        reconcileAttempts: FunctionReference<
          "mutation",
          "internal",
          { before: number },
          null
        >;
        reconcileSections: FunctionReference<
          "mutation",
          "internal",
          { before: number; scheduledAttemptIds: Array<Id<"tryoutAttempts">> },
          null
        >;
        section: FunctionReference<
          "mutation",
          "internal",
          { expiresAt: number; sectionAttemptId: Id<"tryoutSectionAttempts"> },
          null
        >;
        sweep: FunctionReference<"mutation", "internal", {}, null>;
      };
    };
    runtime: {
      signed: {
        stageTryoutRuntimeBundle: FunctionReference<
          "mutation",
          "internal",
          { bundleJson: string; rendererJson: string },
          {
            bundleHash: string;
            created: 0 | 1;
            releaseId: string;
            snapshotId: string;
            unchanged: 0 | 1;
          }
        >;
      };
    };
  };
  users: {
    queries: {
      getUserByAuthId: FunctionReference<
        "query",
        "internal",
        { authId: string },
        {
          _creationTime: number;
          _id: Id<"users">;
          authId: string;
          authVerificationCleanupCursor?: string;
          bio?: string;
          credits: number;
          creditsResetAt: number;
          deletedAt?: number;
          deletionCleanupStartedAt?: number;
          deletionPreparedAt?: number;
          email: string;
          image?: string;
          mascot: string;
          name: string;
          picture?: "animal" | "photo";
          plan: "free" | "pro";
          planCreditGrantId?: Id<"creditTransactions">;
          role?: "teacher" | "student" | "parent" | "administrator";
          username?: string;
        } | null
      >;
      getUserById: FunctionReference<
        "query",
        "internal",
        { userId: Id<"users"> },
        {
          _creationTime: number;
          _id: Id<"users">;
          authId: string;
          authVerificationCleanupCursor?: string;
          bio?: string;
          credits: number;
          creditsResetAt: number;
          deletedAt?: number;
          deletionCleanupStartedAt?: number;
          deletionPreparedAt?: number;
          email: string;
          image?: string;
          mascot: string;
          name: string;
          picture?: "animal" | "photo";
          plan: "free" | "pro";
          planCreditGrantId?: Id<"creditTransactions">;
          role?: "teacher" | "student" | "parent" | "administrator";
          username?: string;
        } | null
      >;
    };
  };
  vault: {
    keys: {
      rewrap: FunctionReference<"mutation", "internal", {}, number>;
    };
  };
};

export declare const components: {
  betterAuth: import("@repo/backend/components/betterAuth/_generated/component.js").ComponentApi<"betterAuth">;
  nina: import("@convex-dev/agent/_generated/component.js").ComponentApi<"nina">;
  agentRateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"agentRateLimiter">;
  workflow: import("@convex-dev/workflow/_generated/component.js").ComponentApi<"workflow">;
  resend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
  posthog: import("@posthog/convex/_generated/component.js").ComponentApi<"posthog">;
  globalLeaderboard: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"globalLeaderboard">;
  learningPopularityRankings: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"learningPopularityRankings">;
};
