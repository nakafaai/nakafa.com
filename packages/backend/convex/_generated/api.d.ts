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
  auth: {
    deletion: {
      cancelAccountDeletionAttempt: FunctionReference<
        "mutation",
        "public",
        { attemptId: string },
        "complete" | "continue"
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
        | "continue"
        | "ready"
        | "school-successor-required"
        | "temporarily-unavailable"
      >;
    };
    queries: {
      getCurrentUser: FunctionReference<
        "query",
        "public",
        {},
        null | {
          appUser: {
            _creationTime: number;
            _id: Id<"users">;
            authId: string;
            authVerificationCleanupCursor?: string;
            credits: number;
            creditsResetAt: number;
            deletedAt?: number;
            deletionCleanupStartedAt?: number;
            deletionPreparedAt?: number;
            email: string;
            image?: string;
            name: string;
            plan: "free" | "pro";
            role?: "teacher" | "student" | "parent" | "administrator";
          };
          authUser: {
            _creationTime: number;
            _id: string;
            createdAt: number;
            displayUsername?: null | string;
            email: string;
            emailVerified: boolean;
            image?: null | string;
            name: string;
            updatedAt: number;
            userId?: null | string;
            username?: null | string;
          };
        }
      >;
      getUserById: FunctionReference<
        "query",
        "public",
        { userId: Id<"users"> },
        null | { image?: string; name: string }
      >;
    };
  };
  chats: {
    actions: {
      scheduleSaveAssistantFailure: FunctionReference<
        "action",
        "public",
        {
          message: {
            chatId: Id<"chats">;
            generationErrorCode: "CHAT_RESPONSE_FAILED";
            identifier: string;
            modelId: "nakafa-lite" | "nakafa-pro";
          };
        },
        null
      >;
      scheduleSaveAssistantResponse: FunctionReference<
        "action",
        "public",
        {
          message: {
            chatId: Id<"chats">;
            credits?: number;
            generationErrorCode?: "CHAT_RESPONSE_FAILED";
            generationStatus?: "complete" | "failed";
            identifier: string;
            inputTokens?: number;
            modelId?: "nakafa-lite" | "nakafa-pro";
            ninaContextSnapshot?: {
              capturedAt: string;
              learning: {
                assetId?: string;
                contentId?: string;
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
              source: "current-page" | "pinned-chat" | "message";
              tools: {
                allowDeepResearch: boolean;
                allowMath: boolean;
                allowNakafa: boolean;
                allowPageFetch: boolean;
                evidenceScope: "verified-page" | "general-learning";
              };
            };
            ninaContextTransition?: {
              fromContextKey?: string;
              reason: "same-context" | "page-context";
              toContextKey: string;
            };
            outputTokens?: number;
            role: "user" | "assistant" | "system";
            totalTokens?: number;
          };
          parts: Array<{
            dataMathData?:
              | {
                  input: {
                    distribution?: string;
                    expression?: string;
                    expressions?: Array<string>;
                    inclusive?: boolean;
                    k?: string;
                    kind: "math";
                    left?: string;
                    lower?: string;
                    lowerInclusive?: boolean;
                    matrix?: Array<Array<string>>;
                    modulus?: string;
                    n?: string;
                    operation:
                      | "apart"
                      | "cancel"
                      | "circle"
                      | "combination"
                      | "compare"
                      | "cumulative_probability"
                      | "determinant"
                      | "differentiate"
                      | "distance"
                      | "distribution"
                      | "domain"
                      | "eigen_analysis"
                      | "eigenvalues"
                      | "eigenvectors"
                      | "evaluate"
                      | "expected_value"
                      | "expand"
                      | "factor"
                      | "gcd"
                      | "integrate"
                      | "intersection"
                      | "inverse"
                      | "interval_probability"
                      | "is_prime"
                      | "lcm"
                      | "limit"
                      | "line"
                      | "linear_system"
                      | "matrix_multiply"
                      | "mean"
                      | "median"
                      | "midpoint"
                      | "mode"
                      | "modular"
                      | "permutation"
                      | "point_probability"
                      | "prime_factorization"
                      | "product"
                      | "quartiles"
                      | "rank"
                      | "rationalize"
                      | "roots"
                      | "rref"
                      | "series"
                      | "simplify"
                      | "slope"
                      | "solve"
                      | "standard_deviation"
                      | "summation"
                      | "tail_probability"
                      | "together"
                      | "variance"
                      | "variance_probability"
                      | "z_score";
                    order?: number;
                    parameters?: {
                      lambda?: string;
                      lower?: string;
                      mean?: string;
                      n?: string;
                      p?: string;
                      standard_deviation?: string;
                      upper?: string;
                    };
                    point?: string;
                    points?: Array<{ x: string; y: string }>;
                    right?: string;
                    right_matrix?: Array<Array<string>>;
                    upper?: string;
                    upperInclusive?: boolean;
                    values?: Array<string>;
                    variable?: string;
                    variables?: Array<string>;
                    vector?: Array<string>;
                  };
                  kind:
                    | "apart"
                    | "cancel"
                    | "circle"
                    | "combination"
                    | "compare"
                    | "cumulative_probability"
                    | "determinant"
                    | "differentiate"
                    | "distance"
                    | "distribution"
                    | "domain"
                    | "eigen_analysis"
                    | "eigenvalues"
                    | "eigenvectors"
                    | "evaluate"
                    | "expected_value"
                    | "expand"
                    | "factor"
                    | "gcd"
                    | "integrate"
                    | "intersection"
                    | "inverse"
                    | "interval_probability"
                    | "is_prime"
                    | "lcm"
                    | "limit"
                    | "line"
                    | "linear_system"
                    | "matrix_multiply"
                    | "mean"
                    | "median"
                    | "midpoint"
                    | "mode"
                    | "modular"
                    | "permutation"
                    | "point_probability"
                    | "prime_factorization"
                    | "product"
                    | "quartiles"
                    | "rank"
                    | "rationalize"
                    | "roots"
                    | "rref"
                    | "series"
                    | "simplify"
                    | "slope"
                    | "solve"
                    | "standard_deviation"
                    | "summation"
                    | "tail_probability"
                    | "together"
                    | "variance"
                    | "variance_probability"
                    | "z_score";
                  status: "loading";
                }
              | {
                  input: {
                    distribution?: string;
                    expression?: string;
                    expressions?: Array<string>;
                    inclusive?: boolean;
                    k?: string;
                    kind: "math";
                    left?: string;
                    lower?: string;
                    lowerInclusive?: boolean;
                    matrix?: Array<Array<string>>;
                    modulus?: string;
                    n?: string;
                    operation:
                      | "apart"
                      | "cancel"
                      | "circle"
                      | "combination"
                      | "compare"
                      | "cumulative_probability"
                      | "determinant"
                      | "differentiate"
                      | "distance"
                      | "distribution"
                      | "domain"
                      | "eigen_analysis"
                      | "eigenvalues"
                      | "eigenvectors"
                      | "evaluate"
                      | "expected_value"
                      | "expand"
                      | "factor"
                      | "gcd"
                      | "integrate"
                      | "intersection"
                      | "inverse"
                      | "interval_probability"
                      | "is_prime"
                      | "lcm"
                      | "limit"
                      | "line"
                      | "linear_system"
                      | "matrix_multiply"
                      | "mean"
                      | "median"
                      | "midpoint"
                      | "mode"
                      | "modular"
                      | "permutation"
                      | "point_probability"
                      | "prime_factorization"
                      | "product"
                      | "quartiles"
                      | "rank"
                      | "rationalize"
                      | "roots"
                      | "rref"
                      | "series"
                      | "simplify"
                      | "slope"
                      | "solve"
                      | "standard_deviation"
                      | "summation"
                      | "tail_probability"
                      | "together"
                      | "variance"
                      | "variance_probability"
                      | "z_score";
                    order?: number;
                    parameters?: {
                      lambda?: string;
                      lower?: string;
                      mean?: string;
                      n?: string;
                      p?: string;
                      standard_deviation?: string;
                      upper?: string;
                    };
                    point?: string;
                    points?: Array<{ x: string; y: string }>;
                    right?: string;
                    right_matrix?: Array<Array<string>>;
                    upper?: string;
                    upperInclusive?: boolean;
                    values?: Array<string>;
                    variable?: string;
                    variables?: Array<string>;
                    vector?: Array<string>;
                  };
                  kind:
                    | "apart"
                    | "cancel"
                    | "circle"
                    | "combination"
                    | "compare"
                    | "cumulative_probability"
                    | "determinant"
                    | "differentiate"
                    | "distance"
                    | "distribution"
                    | "domain"
                    | "eigen_analysis"
                    | "eigenvalues"
                    | "eigenvectors"
                    | "evaluate"
                    | "expected_value"
                    | "expand"
                    | "factor"
                    | "gcd"
                    | "integrate"
                    | "intersection"
                    | "inverse"
                    | "interval_probability"
                    | "is_prime"
                    | "lcm"
                    | "limit"
                    | "line"
                    | "linear_system"
                    | "matrix_multiply"
                    | "mean"
                    | "median"
                    | "midpoint"
                    | "mode"
                    | "modular"
                    | "permutation"
                    | "point_probability"
                    | "prime_factorization"
                    | "product"
                    | "quartiles"
                    | "rank"
                    | "rationalize"
                    | "roots"
                    | "rref"
                    | "series"
                    | "simplify"
                    | "slope"
                    | "solve"
                    | "standard_deviation"
                    | "summation"
                    | "tail_probability"
                    | "together"
                    | "variance"
                    | "variance_probability"
                    | "z_score";
                  result: {
                    conditions: Array<{ expression: string; latex: string }>;
                    input: {
                      distribution?: string;
                      expression?: string;
                      expressions?: Array<string>;
                      inclusive?: boolean;
                      k?: string;
                      kind: "math";
                      left?: string;
                      lower?: string;
                      lowerInclusive?: boolean;
                      matrix?: Array<Array<string>>;
                      modulus?: string;
                      n?: string;
                      operation:
                        | "apart"
                        | "cancel"
                        | "circle"
                        | "combination"
                        | "compare"
                        | "cumulative_probability"
                        | "determinant"
                        | "differentiate"
                        | "distance"
                        | "distribution"
                        | "domain"
                        | "eigen_analysis"
                        | "eigenvalues"
                        | "eigenvectors"
                        | "evaluate"
                        | "expected_value"
                        | "expand"
                        | "factor"
                        | "gcd"
                        | "integrate"
                        | "intersection"
                        | "inverse"
                        | "interval_probability"
                        | "is_prime"
                        | "lcm"
                        | "limit"
                        | "line"
                        | "linear_system"
                        | "matrix_multiply"
                        | "mean"
                        | "median"
                        | "midpoint"
                        | "mode"
                        | "modular"
                        | "permutation"
                        | "point_probability"
                        | "prime_factorization"
                        | "product"
                        | "quartiles"
                        | "rank"
                        | "rationalize"
                        | "roots"
                        | "rref"
                        | "series"
                        | "simplify"
                        | "slope"
                        | "solve"
                        | "standard_deviation"
                        | "summation"
                        | "tail_probability"
                        | "together"
                        | "variance"
                        | "variance_probability"
                        | "z_score";
                      order?: number;
                      parameters?: {
                        lambda?: string;
                        lower?: string;
                        mean?: string;
                        n?: string;
                        p?: string;
                        standard_deviation?: string;
                        upper?: string;
                      };
                      point?: string;
                      points?: Array<{ x: string; y: string }>;
                      right?: string;
                      right_matrix?: Array<Array<string>>;
                      upper?: string;
                      upperInclusive?: boolean;
                      values?: Array<string>;
                      variable?: string;
                      variables?: Array<string>;
                      vector?: Array<string>;
                    };
                    items: Array<{
                      label: string;
                      latex?: string;
                      value: string;
                    }>;
                    kind:
                      | "apart"
                      | "cancel"
                      | "circle"
                      | "combination"
                      | "compare"
                      | "cumulative_probability"
                      | "determinant"
                      | "differentiate"
                      | "distance"
                      | "distribution"
                      | "domain"
                      | "eigen_analysis"
                      | "eigenvalues"
                      | "eigenvectors"
                      | "evaluate"
                      | "expected_value"
                      | "expand"
                      | "factor"
                      | "gcd"
                      | "integrate"
                      | "intersection"
                      | "inverse"
                      | "interval_probability"
                      | "is_prime"
                      | "lcm"
                      | "limit"
                      | "line"
                      | "linear_system"
                      | "matrix_multiply"
                      | "mean"
                      | "median"
                      | "midpoint"
                      | "mode"
                      | "modular"
                      | "permutation"
                      | "point_probability"
                      | "prime_factorization"
                      | "product"
                      | "quartiles"
                      | "rank"
                      | "rationalize"
                      | "roots"
                      | "rref"
                      | "series"
                      | "simplify"
                      | "slope"
                      | "solve"
                      | "standard_deviation"
                      | "summation"
                      | "tail_probability"
                      | "together"
                      | "variance"
                      | "variance_probability"
                      | "z_score";
                    operation:
                      | "apart"
                      | "cancel"
                      | "circle"
                      | "combination"
                      | "compare"
                      | "cumulative_probability"
                      | "determinant"
                      | "differentiate"
                      | "distance"
                      | "distribution"
                      | "domain"
                      | "eigen_analysis"
                      | "eigenvalues"
                      | "eigenvectors"
                      | "evaluate"
                      | "expected_value"
                      | "expand"
                      | "factor"
                      | "gcd"
                      | "integrate"
                      | "intersection"
                      | "inverse"
                      | "interval_probability"
                      | "is_prime"
                      | "lcm"
                      | "limit"
                      | "line"
                      | "linear_system"
                      | "matrix_multiply"
                      | "mean"
                      | "median"
                      | "midpoint"
                      | "mode"
                      | "modular"
                      | "permutation"
                      | "point_probability"
                      | "prime_factorization"
                      | "product"
                      | "quartiles"
                      | "rank"
                      | "rationalize"
                      | "roots"
                      | "rref"
                      | "series"
                      | "simplify"
                      | "slope"
                      | "solve"
                      | "standard_deviation"
                      | "summation"
                      | "tail_probability"
                      | "together"
                      | "variance"
                      | "variance_probability"
                      | "z_score";
                    primary: { expression: string; latex: string };
                    reason: string;
                    secondary?: { expression: string; latex: string };
                    status: "verified" | "contradicted" | "inconclusive";
                    stepStatus: "complete" | "partial" | "unavailable";
                    steps: Array<{
                      action: string;
                      items: Array<{
                        label: string;
                        latex?: string;
                        value: string;
                      }>;
                      primary: { expression: string; latex: string };
                      relation?: { expression: string; latex: string };
                      secondary?: { expression: string; latex: string };
                    }>;
                  };
                  status: "verified" | "contradicted" | "inconclusive";
                  summary: string;
                }
              | {
                  error: string;
                  input: {
                    distribution?: string;
                    expression?: string;
                    expressions?: Array<string>;
                    inclusive?: boolean;
                    k?: string;
                    kind: "math";
                    left?: string;
                    lower?: string;
                    lowerInclusive?: boolean;
                    matrix?: Array<Array<string>>;
                    modulus?: string;
                    n?: string;
                    operation:
                      | "apart"
                      | "cancel"
                      | "circle"
                      | "combination"
                      | "compare"
                      | "cumulative_probability"
                      | "determinant"
                      | "differentiate"
                      | "distance"
                      | "distribution"
                      | "domain"
                      | "eigen_analysis"
                      | "eigenvalues"
                      | "eigenvectors"
                      | "evaluate"
                      | "expected_value"
                      | "expand"
                      | "factor"
                      | "gcd"
                      | "integrate"
                      | "intersection"
                      | "inverse"
                      | "interval_probability"
                      | "is_prime"
                      | "lcm"
                      | "limit"
                      | "line"
                      | "linear_system"
                      | "matrix_multiply"
                      | "mean"
                      | "median"
                      | "midpoint"
                      | "mode"
                      | "modular"
                      | "permutation"
                      | "point_probability"
                      | "prime_factorization"
                      | "product"
                      | "quartiles"
                      | "rank"
                      | "rationalize"
                      | "roots"
                      | "rref"
                      | "series"
                      | "simplify"
                      | "slope"
                      | "solve"
                      | "standard_deviation"
                      | "summation"
                      | "tail_probability"
                      | "together"
                      | "variance"
                      | "variance_probability"
                      | "z_score";
                    order?: number;
                    parameters?: {
                      lambda?: string;
                      lower?: string;
                      mean?: string;
                      n?: string;
                      p?: string;
                      standard_deviation?: string;
                      upper?: string;
                    };
                    point?: string;
                    points?: Array<{ x: string; y: string }>;
                    right?: string;
                    right_matrix?: Array<Array<string>>;
                    upper?: string;
                    upperInclusive?: boolean;
                    values?: Array<string>;
                    variable?: string;
                    variables?: Array<string>;
                    vector?: Array<string>;
                  };
                  kind:
                    | "apart"
                    | "cancel"
                    | "circle"
                    | "combination"
                    | "compare"
                    | "cumulative_probability"
                    | "determinant"
                    | "differentiate"
                    | "distance"
                    | "distribution"
                    | "domain"
                    | "eigen_analysis"
                    | "eigenvalues"
                    | "eigenvectors"
                    | "evaluate"
                    | "expected_value"
                    | "expand"
                    | "factor"
                    | "gcd"
                    | "integrate"
                    | "intersection"
                    | "inverse"
                    | "interval_probability"
                    | "is_prime"
                    | "lcm"
                    | "limit"
                    | "line"
                    | "linear_system"
                    | "matrix_multiply"
                    | "mean"
                    | "median"
                    | "midpoint"
                    | "mode"
                    | "modular"
                    | "permutation"
                    | "point_probability"
                    | "prime_factorization"
                    | "product"
                    | "quartiles"
                    | "rank"
                    | "rationalize"
                    | "roots"
                    | "rref"
                    | "series"
                    | "simplify"
                    | "slope"
                    | "solve"
                    | "standard_deviation"
                    | "summation"
                    | "tail_probability"
                    | "together"
                    | "variance"
                    | "variance_probability"
                    | "z_score";
                  status: "error";
                };
            dataMathId?: string;
            dataNakafaData?:
              | {
                  input: {
                    limit: number;
                    locale: "en" | "id" | "de";
                    offset: number;
                    queries?: Array<string>;
                    section?: "articles" | "material" | "tryout" | "quran";
                  };
                  kind: "search";
                  status: "loading";
                }
              | {
                  input: {
                    limit: number;
                    locale: "en" | "id" | "de";
                    offset: number;
                    queries?: Array<string>;
                    section?: "articles" | "material" | "tryout" | "quran";
                  };
                  kind: "search";
                  result: {
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
                  };
                  status: "done";
                }
              | {
                  error: string;
                  input: {
                    limit: number;
                    locale: "en" | "id" | "de";
                    offset: number;
                    queries?: Array<string>;
                    section?: "articles" | "material" | "tryout" | "quran";
                  };
                  kind: "search";
                  status: "error";
                }
              | {
                  input: { content_ref: string };
                  kind: "content";
                  status: "loading";
                }
              | {
                  input: { content_ref: string };
                  kind: "content";
                  result: {
                    alignmentId: string;
                    assetId: string;
                    conceptId: string;
                    content_id: string;
                    description?: string;
                    learningObjectId: string;
                    lensId: string;
                    locale: "en" | "id" | "de";
                    markdown_url?: string;
                    route: string;
                    section: "articles" | "material" | "tryout" | "quran";
                    title: string;
                    url: string;
                  };
                  status: "done";
                }
              | {
                  error: string;
                  input: { content_ref: string };
                  kind: "content";
                  status: "error";
                }
              | {
                  input: {
                    from_verse: number;
                    include_tafsir: boolean;
                    locale: "en" | "id" | "de";
                    surah: number;
                    to_verse?: number;
                  };
                  kind: "quran";
                  status: "loading";
                }
              | {
                  input: {
                    from_verse: number;
                    include_tafsir: boolean;
                    locale: "en";
                    surah: number;
                    to_verse?: number;
                  };
                  kind: "quran";
                  result: {
                    alignmentId: string;
                    assetId: string;
                    conceptId: string;
                    content_id: string;
                    from_verse: number;
                    learningObjectId: string;
                    lensId: string;
                    locale: "en";
                    markdown_url?: string;
                    meaning: { locale: "en" | "en"; text: string };
                    name: string;
                    revelation: string;
                    route: string;
                    section: "articles" | "material" | "tryout" | "quran";
                    to_verse: number;
                    url: string;
                    verse_count: number;
                  };
                  status: "done";
                }
              | {
                  input: {
                    from_verse: number;
                    include_tafsir: boolean;
                    locale: "id";
                    surah: number;
                    to_verse?: number;
                  };
                  kind: "quran";
                  result: {
                    alignmentId: string;
                    assetId: string;
                    conceptId: string;
                    content_id: string;
                    from_verse: number;
                    learningObjectId: string;
                    lensId: string;
                    locale: "id";
                    markdown_url?: string;
                    meaning: { locale: "id" | "en"; text: string };
                    name: string;
                    revelation: string;
                    route: string;
                    section: "articles" | "material" | "tryout" | "quran";
                    to_verse: number;
                    url: string;
                    verse_count: number;
                  };
                  status: "done";
                }
              | {
                  input: {
                    from_verse: number;
                    include_tafsir: boolean;
                    locale: "de";
                    surah: number;
                    to_verse?: number;
                  };
                  kind: "quran";
                  result: {
                    alignmentId: string;
                    assetId: string;
                    conceptId: string;
                    content_id: string;
                    from_verse: number;
                    learningObjectId: string;
                    lensId: string;
                    locale: "de";
                    markdown_url?: string;
                    meaning: { locale: "de" | "en"; text: string };
                    name: string;
                    revelation: string;
                    route: string;
                    section: "articles" | "material" | "tryout" | "quran";
                    to_verse: number;
                    url: string;
                    verse_count: number;
                  };
                  status: "done";
                }
              | {
                  input: {
                    from_verse: number;
                    include_tafsir: boolean;
                    locale: "en" | "id" | "de";
                    surah: number;
                    to_verse?: number;
                  };
                  kind: "quran";
                  result: {
                    alignmentId: string;
                    assetId: string;
                    conceptId: string;
                    content_id: string;
                    from_verse: number;
                    learningObjectId: string;
                    lensId: string;
                    locale: "en" | "id" | "de";
                    markdown_url?: string;
                    name: string;
                    revelation: string;
                    route: string;
                    section: "articles" | "material" | "tryout" | "quran";
                    to_verse: number;
                    translation: string;
                    url: string;
                    verse_count: number;
                  };
                  status: "done";
                }
              | {
                  error: string;
                  input: {
                    from_verse: number;
                    include_tafsir: boolean;
                    locale: "en" | "id" | "de";
                    surah: number;
                    to_verse?: number;
                  };
                  kind: "quran";
                  status: "error";
                }
              | {
                  input: { locale: "en" | "id" | "de" };
                  kind: "taxonomy";
                  status: "loading";
                }
              | {
                  input: { locale: "en" | "id" | "de" };
                  kind: "taxonomy";
                  result: {
                    content_counts: Array<{
                      count: number;
                      locale: "en" | "id" | "de";
                    }>;
                    locale: "en" | "id" | "de";
                    sections: Array<
                      "articles" | "material" | "tryout" | "quran"
                    >;
                    tools: Array<string>;
                  };
                  status: "done";
                }
              | {
                  error: string;
                  input: { locale: "en" | "id" | "de" };
                  kind: "taxonomy";
                  status: "error";
                };
            dataNakafaId?: string;
            dataScrapeUrlContent?: string;
            dataScrapeUrlDescription?: string;
            dataScrapeUrlError?: string;
            dataScrapeUrlFavicon?: string;
            dataScrapeUrlId?: string;
            dataScrapeUrlStatus?: "loading" | "done" | "error";
            dataScrapeUrlTitle?: string;
            dataScrapeUrlUrl?: string;
            dataSuggestionsData?: Array<string>;
            dataSuggestionsId?: string;
            dataWebSearchError?: string;
            dataWebSearchId?: string;
            dataWebSearchProvider?: "firecrawl" | "google";
            dataWebSearchQueries?: Array<string>;
            dataWebSearchSources?: Array<{
              citation: string;
              content: string;
              description: string;
              title: string;
              url: string;
            }>;
            dataWebSearchStatus?: "loading" | "done" | "error";
            fileFilename?: string;
            fileMediaType?: string;
            fileUrl?: string;
            messageId?: Id<"messages">;
            order: number;
            providerMetadata?: Record<string, Record<string, string>>;
            reasoningState?: "streaming" | "done";
            reasoningText?: string;
            textState?: "streaming" | "done";
            textText?: string;
            toolCallProviderMetadata?: Record<string, Record<string, string>>;
            toolDeepResearchInput?: {
              objective: string;
              request: string;
              requirements?: Array<string>;
              sourceRequirements: Array<string>;
            };
            toolDeepResearchOutput?: string;
            toolErrorText?: string;
            toolMathInput?: {
              given: Array<string>;
              objective: string;
              request: string;
              requirements?: Array<string>;
            };
            toolMathOutput?: string;
            toolNakafaInput?: {
              deliverables: Array<string>;
              objective: string;
              request: string;
              requirements?: Array<string>;
            };
            toolNakafaOutput?: string;
            toolResultProviderMetadata?: Record<string, Record<string, string>>;
            toolState?:
              | "input-streaming"
              | "input-available"
              | "output-available"
              | "output-error";
            toolToolCallId?: string;
            type:
              | "text"
              | "reasoning"
              | "file"
              | "step-start"
              | "tool-nakafa"
              | "tool-deepResearch"
              | "tool-math"
              | "data-suggestions"
              | "data-nakafa"
              | "data-math"
              | "data-scrape-url"
              | "data-web-search";
          }>;
        },
        null
      >;
    };
    mutations: {
      createChat: FunctionReference<
        "mutation",
        "public",
        { title?: string; type: "study" },
        Id<"chats">
      >;
      createChatWithMessage: FunctionReference<
        "mutation",
        "public",
        {
          message: {
            chatId?: Id<"chats">;
            credits?: number;
            generationErrorCode?: "CHAT_RESPONSE_FAILED";
            generationStatus?: "complete" | "failed";
            identifier: string;
            inputTokens?: number;
            modelId?: "nakafa-lite" | "nakafa-pro";
            ninaContextSnapshot?: {
              capturedAt: string;
              learning: {
                assetId?: string;
                contentId?: string;
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
              source: "current-page" | "pinned-chat" | "message";
              tools: {
                allowDeepResearch: boolean;
                allowMath: boolean;
                allowNakafa: boolean;
                allowPageFetch: boolean;
                evidenceScope: "verified-page" | "general-learning";
              };
            };
            ninaContextTransition?: {
              fromContextKey?: string;
              reason: "same-context" | "page-context";
              toContextKey: string;
            };
            outputTokens?: number;
            role: "user" | "assistant" | "system";
            totalTokens?: number;
          };
          parts: Array<{
            dataMathData?:
              | {
                  input: {
                    distribution?: string;
                    expression?: string;
                    expressions?: Array<string>;
                    inclusive?: boolean;
                    k?: string;
                    kind: "math";
                    left?: string;
                    lower?: string;
                    lowerInclusive?: boolean;
                    matrix?: Array<Array<string>>;
                    modulus?: string;
                    n?: string;
                    operation:
                      | "apart"
                      | "cancel"
                      | "circle"
                      | "combination"
                      | "compare"
                      | "cumulative_probability"
                      | "determinant"
                      | "differentiate"
                      | "distance"
                      | "distribution"
                      | "domain"
                      | "eigen_analysis"
                      | "eigenvalues"
                      | "eigenvectors"
                      | "evaluate"
                      | "expected_value"
                      | "expand"
                      | "factor"
                      | "gcd"
                      | "integrate"
                      | "intersection"
                      | "inverse"
                      | "interval_probability"
                      | "is_prime"
                      | "lcm"
                      | "limit"
                      | "line"
                      | "linear_system"
                      | "matrix_multiply"
                      | "mean"
                      | "median"
                      | "midpoint"
                      | "mode"
                      | "modular"
                      | "permutation"
                      | "point_probability"
                      | "prime_factorization"
                      | "product"
                      | "quartiles"
                      | "rank"
                      | "rationalize"
                      | "roots"
                      | "rref"
                      | "series"
                      | "simplify"
                      | "slope"
                      | "solve"
                      | "standard_deviation"
                      | "summation"
                      | "tail_probability"
                      | "together"
                      | "variance"
                      | "variance_probability"
                      | "z_score";
                    order?: number;
                    parameters?: {
                      lambda?: string;
                      lower?: string;
                      mean?: string;
                      n?: string;
                      p?: string;
                      standard_deviation?: string;
                      upper?: string;
                    };
                    point?: string;
                    points?: Array<{ x: string; y: string }>;
                    right?: string;
                    right_matrix?: Array<Array<string>>;
                    upper?: string;
                    upperInclusive?: boolean;
                    values?: Array<string>;
                    variable?: string;
                    variables?: Array<string>;
                    vector?: Array<string>;
                  };
                  kind:
                    | "apart"
                    | "cancel"
                    | "circle"
                    | "combination"
                    | "compare"
                    | "cumulative_probability"
                    | "determinant"
                    | "differentiate"
                    | "distance"
                    | "distribution"
                    | "domain"
                    | "eigen_analysis"
                    | "eigenvalues"
                    | "eigenvectors"
                    | "evaluate"
                    | "expected_value"
                    | "expand"
                    | "factor"
                    | "gcd"
                    | "integrate"
                    | "intersection"
                    | "inverse"
                    | "interval_probability"
                    | "is_prime"
                    | "lcm"
                    | "limit"
                    | "line"
                    | "linear_system"
                    | "matrix_multiply"
                    | "mean"
                    | "median"
                    | "midpoint"
                    | "mode"
                    | "modular"
                    | "permutation"
                    | "point_probability"
                    | "prime_factorization"
                    | "product"
                    | "quartiles"
                    | "rank"
                    | "rationalize"
                    | "roots"
                    | "rref"
                    | "series"
                    | "simplify"
                    | "slope"
                    | "solve"
                    | "standard_deviation"
                    | "summation"
                    | "tail_probability"
                    | "together"
                    | "variance"
                    | "variance_probability"
                    | "z_score";
                  status: "loading";
                }
              | {
                  input: {
                    distribution?: string;
                    expression?: string;
                    expressions?: Array<string>;
                    inclusive?: boolean;
                    k?: string;
                    kind: "math";
                    left?: string;
                    lower?: string;
                    lowerInclusive?: boolean;
                    matrix?: Array<Array<string>>;
                    modulus?: string;
                    n?: string;
                    operation:
                      | "apart"
                      | "cancel"
                      | "circle"
                      | "combination"
                      | "compare"
                      | "cumulative_probability"
                      | "determinant"
                      | "differentiate"
                      | "distance"
                      | "distribution"
                      | "domain"
                      | "eigen_analysis"
                      | "eigenvalues"
                      | "eigenvectors"
                      | "evaluate"
                      | "expected_value"
                      | "expand"
                      | "factor"
                      | "gcd"
                      | "integrate"
                      | "intersection"
                      | "inverse"
                      | "interval_probability"
                      | "is_prime"
                      | "lcm"
                      | "limit"
                      | "line"
                      | "linear_system"
                      | "matrix_multiply"
                      | "mean"
                      | "median"
                      | "midpoint"
                      | "mode"
                      | "modular"
                      | "permutation"
                      | "point_probability"
                      | "prime_factorization"
                      | "product"
                      | "quartiles"
                      | "rank"
                      | "rationalize"
                      | "roots"
                      | "rref"
                      | "series"
                      | "simplify"
                      | "slope"
                      | "solve"
                      | "standard_deviation"
                      | "summation"
                      | "tail_probability"
                      | "together"
                      | "variance"
                      | "variance_probability"
                      | "z_score";
                    order?: number;
                    parameters?: {
                      lambda?: string;
                      lower?: string;
                      mean?: string;
                      n?: string;
                      p?: string;
                      standard_deviation?: string;
                      upper?: string;
                    };
                    point?: string;
                    points?: Array<{ x: string; y: string }>;
                    right?: string;
                    right_matrix?: Array<Array<string>>;
                    upper?: string;
                    upperInclusive?: boolean;
                    values?: Array<string>;
                    variable?: string;
                    variables?: Array<string>;
                    vector?: Array<string>;
                  };
                  kind:
                    | "apart"
                    | "cancel"
                    | "circle"
                    | "combination"
                    | "compare"
                    | "cumulative_probability"
                    | "determinant"
                    | "differentiate"
                    | "distance"
                    | "distribution"
                    | "domain"
                    | "eigen_analysis"
                    | "eigenvalues"
                    | "eigenvectors"
                    | "evaluate"
                    | "expected_value"
                    | "expand"
                    | "factor"
                    | "gcd"
                    | "integrate"
                    | "intersection"
                    | "inverse"
                    | "interval_probability"
                    | "is_prime"
                    | "lcm"
                    | "limit"
                    | "line"
                    | "linear_system"
                    | "matrix_multiply"
                    | "mean"
                    | "median"
                    | "midpoint"
                    | "mode"
                    | "modular"
                    | "permutation"
                    | "point_probability"
                    | "prime_factorization"
                    | "product"
                    | "quartiles"
                    | "rank"
                    | "rationalize"
                    | "roots"
                    | "rref"
                    | "series"
                    | "simplify"
                    | "slope"
                    | "solve"
                    | "standard_deviation"
                    | "summation"
                    | "tail_probability"
                    | "together"
                    | "variance"
                    | "variance_probability"
                    | "z_score";
                  result: {
                    conditions: Array<{ expression: string; latex: string }>;
                    input: {
                      distribution?: string;
                      expression?: string;
                      expressions?: Array<string>;
                      inclusive?: boolean;
                      k?: string;
                      kind: "math";
                      left?: string;
                      lower?: string;
                      lowerInclusive?: boolean;
                      matrix?: Array<Array<string>>;
                      modulus?: string;
                      n?: string;
                      operation:
                        | "apart"
                        | "cancel"
                        | "circle"
                        | "combination"
                        | "compare"
                        | "cumulative_probability"
                        | "determinant"
                        | "differentiate"
                        | "distance"
                        | "distribution"
                        | "domain"
                        | "eigen_analysis"
                        | "eigenvalues"
                        | "eigenvectors"
                        | "evaluate"
                        | "expected_value"
                        | "expand"
                        | "factor"
                        | "gcd"
                        | "integrate"
                        | "intersection"
                        | "inverse"
                        | "interval_probability"
                        | "is_prime"
                        | "lcm"
                        | "limit"
                        | "line"
                        | "linear_system"
                        | "matrix_multiply"
                        | "mean"
                        | "median"
                        | "midpoint"
                        | "mode"
                        | "modular"
                        | "permutation"
                        | "point_probability"
                        | "prime_factorization"
                        | "product"
                        | "quartiles"
                        | "rank"
                        | "rationalize"
                        | "roots"
                        | "rref"
                        | "series"
                        | "simplify"
                        | "slope"
                        | "solve"
                        | "standard_deviation"
                        | "summation"
                        | "tail_probability"
                        | "together"
                        | "variance"
                        | "variance_probability"
                        | "z_score";
                      order?: number;
                      parameters?: {
                        lambda?: string;
                        lower?: string;
                        mean?: string;
                        n?: string;
                        p?: string;
                        standard_deviation?: string;
                        upper?: string;
                      };
                      point?: string;
                      points?: Array<{ x: string; y: string }>;
                      right?: string;
                      right_matrix?: Array<Array<string>>;
                      upper?: string;
                      upperInclusive?: boolean;
                      values?: Array<string>;
                      variable?: string;
                      variables?: Array<string>;
                      vector?: Array<string>;
                    };
                    items: Array<{
                      label: string;
                      latex?: string;
                      value: string;
                    }>;
                    kind:
                      | "apart"
                      | "cancel"
                      | "circle"
                      | "combination"
                      | "compare"
                      | "cumulative_probability"
                      | "determinant"
                      | "differentiate"
                      | "distance"
                      | "distribution"
                      | "domain"
                      | "eigen_analysis"
                      | "eigenvalues"
                      | "eigenvectors"
                      | "evaluate"
                      | "expected_value"
                      | "expand"
                      | "factor"
                      | "gcd"
                      | "integrate"
                      | "intersection"
                      | "inverse"
                      | "interval_probability"
                      | "is_prime"
                      | "lcm"
                      | "limit"
                      | "line"
                      | "linear_system"
                      | "matrix_multiply"
                      | "mean"
                      | "median"
                      | "midpoint"
                      | "mode"
                      | "modular"
                      | "permutation"
                      | "point_probability"
                      | "prime_factorization"
                      | "product"
                      | "quartiles"
                      | "rank"
                      | "rationalize"
                      | "roots"
                      | "rref"
                      | "series"
                      | "simplify"
                      | "slope"
                      | "solve"
                      | "standard_deviation"
                      | "summation"
                      | "tail_probability"
                      | "together"
                      | "variance"
                      | "variance_probability"
                      | "z_score";
                    operation:
                      | "apart"
                      | "cancel"
                      | "circle"
                      | "combination"
                      | "compare"
                      | "cumulative_probability"
                      | "determinant"
                      | "differentiate"
                      | "distance"
                      | "distribution"
                      | "domain"
                      | "eigen_analysis"
                      | "eigenvalues"
                      | "eigenvectors"
                      | "evaluate"
                      | "expected_value"
                      | "expand"
                      | "factor"
                      | "gcd"
                      | "integrate"
                      | "intersection"
                      | "inverse"
                      | "interval_probability"
                      | "is_prime"
                      | "lcm"
                      | "limit"
                      | "line"
                      | "linear_system"
                      | "matrix_multiply"
                      | "mean"
                      | "median"
                      | "midpoint"
                      | "mode"
                      | "modular"
                      | "permutation"
                      | "point_probability"
                      | "prime_factorization"
                      | "product"
                      | "quartiles"
                      | "rank"
                      | "rationalize"
                      | "roots"
                      | "rref"
                      | "series"
                      | "simplify"
                      | "slope"
                      | "solve"
                      | "standard_deviation"
                      | "summation"
                      | "tail_probability"
                      | "together"
                      | "variance"
                      | "variance_probability"
                      | "z_score";
                    primary: { expression: string; latex: string };
                    reason: string;
                    secondary?: { expression: string; latex: string };
                    status: "verified" | "contradicted" | "inconclusive";
                    stepStatus: "complete" | "partial" | "unavailable";
                    steps: Array<{
                      action: string;
                      items: Array<{
                        label: string;
                        latex?: string;
                        value: string;
                      }>;
                      primary: { expression: string; latex: string };
                      relation?: { expression: string; latex: string };
                      secondary?: { expression: string; latex: string };
                    }>;
                  };
                  status: "verified" | "contradicted" | "inconclusive";
                  summary: string;
                }
              | {
                  error: string;
                  input: {
                    distribution?: string;
                    expression?: string;
                    expressions?: Array<string>;
                    inclusive?: boolean;
                    k?: string;
                    kind: "math";
                    left?: string;
                    lower?: string;
                    lowerInclusive?: boolean;
                    matrix?: Array<Array<string>>;
                    modulus?: string;
                    n?: string;
                    operation:
                      | "apart"
                      | "cancel"
                      | "circle"
                      | "combination"
                      | "compare"
                      | "cumulative_probability"
                      | "determinant"
                      | "differentiate"
                      | "distance"
                      | "distribution"
                      | "domain"
                      | "eigen_analysis"
                      | "eigenvalues"
                      | "eigenvectors"
                      | "evaluate"
                      | "expected_value"
                      | "expand"
                      | "factor"
                      | "gcd"
                      | "integrate"
                      | "intersection"
                      | "inverse"
                      | "interval_probability"
                      | "is_prime"
                      | "lcm"
                      | "limit"
                      | "line"
                      | "linear_system"
                      | "matrix_multiply"
                      | "mean"
                      | "median"
                      | "midpoint"
                      | "mode"
                      | "modular"
                      | "permutation"
                      | "point_probability"
                      | "prime_factorization"
                      | "product"
                      | "quartiles"
                      | "rank"
                      | "rationalize"
                      | "roots"
                      | "rref"
                      | "series"
                      | "simplify"
                      | "slope"
                      | "solve"
                      | "standard_deviation"
                      | "summation"
                      | "tail_probability"
                      | "together"
                      | "variance"
                      | "variance_probability"
                      | "z_score";
                    order?: number;
                    parameters?: {
                      lambda?: string;
                      lower?: string;
                      mean?: string;
                      n?: string;
                      p?: string;
                      standard_deviation?: string;
                      upper?: string;
                    };
                    point?: string;
                    points?: Array<{ x: string; y: string }>;
                    right?: string;
                    right_matrix?: Array<Array<string>>;
                    upper?: string;
                    upperInclusive?: boolean;
                    values?: Array<string>;
                    variable?: string;
                    variables?: Array<string>;
                    vector?: Array<string>;
                  };
                  kind:
                    | "apart"
                    | "cancel"
                    | "circle"
                    | "combination"
                    | "compare"
                    | "cumulative_probability"
                    | "determinant"
                    | "differentiate"
                    | "distance"
                    | "distribution"
                    | "domain"
                    | "eigen_analysis"
                    | "eigenvalues"
                    | "eigenvectors"
                    | "evaluate"
                    | "expected_value"
                    | "expand"
                    | "factor"
                    | "gcd"
                    | "integrate"
                    | "intersection"
                    | "inverse"
                    | "interval_probability"
                    | "is_prime"
                    | "lcm"
                    | "limit"
                    | "line"
                    | "linear_system"
                    | "matrix_multiply"
                    | "mean"
                    | "median"
                    | "midpoint"
                    | "mode"
                    | "modular"
                    | "permutation"
                    | "point_probability"
                    | "prime_factorization"
                    | "product"
                    | "quartiles"
                    | "rank"
                    | "rationalize"
                    | "roots"
                    | "rref"
                    | "series"
                    | "simplify"
                    | "slope"
                    | "solve"
                    | "standard_deviation"
                    | "summation"
                    | "tail_probability"
                    | "together"
                    | "variance"
                    | "variance_probability"
                    | "z_score";
                  status: "error";
                };
            dataMathId?: string;
            dataNakafaData?:
              | {
                  input: {
                    limit: number;
                    locale: "en" | "id" | "de";
                    offset: number;
                    queries?: Array<string>;
                    section?: "articles" | "material" | "tryout" | "quran";
                  };
                  kind: "search";
                  status: "loading";
                }
              | {
                  input: {
                    limit: number;
                    locale: "en" | "id" | "de";
                    offset: number;
                    queries?: Array<string>;
                    section?: "articles" | "material" | "tryout" | "quran";
                  };
                  kind: "search";
                  result: {
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
                  };
                  status: "done";
                }
              | {
                  error: string;
                  input: {
                    limit: number;
                    locale: "en" | "id" | "de";
                    offset: number;
                    queries?: Array<string>;
                    section?: "articles" | "material" | "tryout" | "quran";
                  };
                  kind: "search";
                  status: "error";
                }
              | {
                  input: { content_ref: string };
                  kind: "content";
                  status: "loading";
                }
              | {
                  input: { content_ref: string };
                  kind: "content";
                  result: {
                    alignmentId: string;
                    assetId: string;
                    conceptId: string;
                    content_id: string;
                    description?: string;
                    learningObjectId: string;
                    lensId: string;
                    locale: "en" | "id" | "de";
                    markdown_url?: string;
                    route: string;
                    section: "articles" | "material" | "tryout" | "quran";
                    title: string;
                    url: string;
                  };
                  status: "done";
                }
              | {
                  error: string;
                  input: { content_ref: string };
                  kind: "content";
                  status: "error";
                }
              | {
                  input: {
                    from_verse: number;
                    include_tafsir: boolean;
                    locale: "en" | "id" | "de";
                    surah: number;
                    to_verse?: number;
                  };
                  kind: "quran";
                  status: "loading";
                }
              | {
                  input: {
                    from_verse: number;
                    include_tafsir: boolean;
                    locale: "en";
                    surah: number;
                    to_verse?: number;
                  };
                  kind: "quran";
                  result: {
                    alignmentId: string;
                    assetId: string;
                    conceptId: string;
                    content_id: string;
                    from_verse: number;
                    learningObjectId: string;
                    lensId: string;
                    locale: "en";
                    markdown_url?: string;
                    meaning: { locale: "en" | "en"; text: string };
                    name: string;
                    revelation: string;
                    route: string;
                    section: "articles" | "material" | "tryout" | "quran";
                    to_verse: number;
                    url: string;
                    verse_count: number;
                  };
                  status: "done";
                }
              | {
                  input: {
                    from_verse: number;
                    include_tafsir: boolean;
                    locale: "id";
                    surah: number;
                    to_verse?: number;
                  };
                  kind: "quran";
                  result: {
                    alignmentId: string;
                    assetId: string;
                    conceptId: string;
                    content_id: string;
                    from_verse: number;
                    learningObjectId: string;
                    lensId: string;
                    locale: "id";
                    markdown_url?: string;
                    meaning: { locale: "id" | "en"; text: string };
                    name: string;
                    revelation: string;
                    route: string;
                    section: "articles" | "material" | "tryout" | "quran";
                    to_verse: number;
                    url: string;
                    verse_count: number;
                  };
                  status: "done";
                }
              | {
                  input: {
                    from_verse: number;
                    include_tafsir: boolean;
                    locale: "de";
                    surah: number;
                    to_verse?: number;
                  };
                  kind: "quran";
                  result: {
                    alignmentId: string;
                    assetId: string;
                    conceptId: string;
                    content_id: string;
                    from_verse: number;
                    learningObjectId: string;
                    lensId: string;
                    locale: "de";
                    markdown_url?: string;
                    meaning: { locale: "de" | "en"; text: string };
                    name: string;
                    revelation: string;
                    route: string;
                    section: "articles" | "material" | "tryout" | "quran";
                    to_verse: number;
                    url: string;
                    verse_count: number;
                  };
                  status: "done";
                }
              | {
                  input: {
                    from_verse: number;
                    include_tafsir: boolean;
                    locale: "en" | "id" | "de";
                    surah: number;
                    to_verse?: number;
                  };
                  kind: "quran";
                  result: {
                    alignmentId: string;
                    assetId: string;
                    conceptId: string;
                    content_id: string;
                    from_verse: number;
                    learningObjectId: string;
                    lensId: string;
                    locale: "en" | "id" | "de";
                    markdown_url?: string;
                    name: string;
                    revelation: string;
                    route: string;
                    section: "articles" | "material" | "tryout" | "quran";
                    to_verse: number;
                    translation: string;
                    url: string;
                    verse_count: number;
                  };
                  status: "done";
                }
              | {
                  error: string;
                  input: {
                    from_verse: number;
                    include_tafsir: boolean;
                    locale: "en" | "id" | "de";
                    surah: number;
                    to_verse?: number;
                  };
                  kind: "quran";
                  status: "error";
                }
              | {
                  input: { locale: "en" | "id" | "de" };
                  kind: "taxonomy";
                  status: "loading";
                }
              | {
                  input: { locale: "en" | "id" | "de" };
                  kind: "taxonomy";
                  result: {
                    content_counts: Array<{
                      count: number;
                      locale: "en" | "id" | "de";
                    }>;
                    locale: "en" | "id" | "de";
                    sections: Array<
                      "articles" | "material" | "tryout" | "quran"
                    >;
                    tools: Array<string>;
                  };
                  status: "done";
                }
              | {
                  error: string;
                  input: { locale: "en" | "id" | "de" };
                  kind: "taxonomy";
                  status: "error";
                };
            dataNakafaId?: string;
            dataScrapeUrlContent?: string;
            dataScrapeUrlDescription?: string;
            dataScrapeUrlError?: string;
            dataScrapeUrlFavicon?: string;
            dataScrapeUrlId?: string;
            dataScrapeUrlStatus?: "loading" | "done" | "error";
            dataScrapeUrlTitle?: string;
            dataScrapeUrlUrl?: string;
            dataSuggestionsData?: Array<string>;
            dataSuggestionsId?: string;
            dataWebSearchError?: string;
            dataWebSearchId?: string;
            dataWebSearchProvider?: "firecrawl" | "google";
            dataWebSearchQueries?: Array<string>;
            dataWebSearchSources?: Array<{
              citation: string;
              content: string;
              description: string;
              title: string;
              url: string;
            }>;
            dataWebSearchStatus?: "loading" | "done" | "error";
            fileFilename?: string;
            fileMediaType?: string;
            fileUrl?: string;
            messageId?: Id<"messages">;
            order: number;
            providerMetadata?: Record<string, Record<string, string>>;
            reasoningState?: "streaming" | "done";
            reasoningText?: string;
            textState?: "streaming" | "done";
            textText?: string;
            toolCallProviderMetadata?: Record<string, Record<string, string>>;
            toolDeepResearchInput?: {
              objective: string;
              request: string;
              requirements?: Array<string>;
              sourceRequirements: Array<string>;
            };
            toolDeepResearchOutput?: string;
            toolErrorText?: string;
            toolMathInput?: {
              given: Array<string>;
              objective: string;
              request: string;
              requirements?: Array<string>;
            };
            toolMathOutput?: string;
            toolNakafaInput?: {
              deliverables: Array<string>;
              objective: string;
              request: string;
              requirements?: Array<string>;
            };
            toolNakafaOutput?: string;
            toolResultProviderMetadata?: Record<string, Record<string, string>>;
            toolState?:
              | "input-streaming"
              | "input-available"
              | "output-available"
              | "output-error";
            toolToolCallId?: string;
            type:
              | "text"
              | "reasoning"
              | "file"
              | "step-start"
              | "tool-nakafa"
              | "tool-deepResearch"
              | "tool-math"
              | "data-suggestions"
              | "data-nakafa"
              | "data-math"
              | "data-scrape-url"
              | "data-web-search";
          }>;
          title?: string;
          type: "study";
        },
        {
          chatId: Id<"chats">;
          messageId: Id<"messages">;
          partIds: Array<Id<"messageParts">>;
        }
      >;
      deleteChat: FunctionReference<
        "mutation",
        "public",
        { chatId: Id<"chats"> },
        null
      >;
      saveMessage: FunctionReference<
        "mutation",
        "public",
        {
          message: {
            chatId: Id<"chats">;
            credits?: number;
            generationErrorCode?: "CHAT_RESPONSE_FAILED";
            generationStatus?: "complete" | "failed";
            identifier: string;
            inputTokens?: number;
            modelId?: "nakafa-lite" | "nakafa-pro";
            ninaContextSnapshot?: {
              capturedAt: string;
              learning: {
                assetId?: string;
                contentId?: string;
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
              source: "current-page" | "pinned-chat" | "message";
              tools: {
                allowDeepResearch: boolean;
                allowMath: boolean;
                allowNakafa: boolean;
                allowPageFetch: boolean;
                evidenceScope: "verified-page" | "general-learning";
              };
            };
            ninaContextTransition?: {
              fromContextKey?: string;
              reason: "same-context" | "page-context";
              toContextKey: string;
            };
            outputTokens?: number;
            role: "user" | "assistant" | "system";
            totalTokens?: number;
          };
          parts: Array<{
            dataMathData?:
              | {
                  input: {
                    distribution?: string;
                    expression?: string;
                    expressions?: Array<string>;
                    inclusive?: boolean;
                    k?: string;
                    kind: "math";
                    left?: string;
                    lower?: string;
                    lowerInclusive?: boolean;
                    matrix?: Array<Array<string>>;
                    modulus?: string;
                    n?: string;
                    operation:
                      | "apart"
                      | "cancel"
                      | "circle"
                      | "combination"
                      | "compare"
                      | "cumulative_probability"
                      | "determinant"
                      | "differentiate"
                      | "distance"
                      | "distribution"
                      | "domain"
                      | "eigen_analysis"
                      | "eigenvalues"
                      | "eigenvectors"
                      | "evaluate"
                      | "expected_value"
                      | "expand"
                      | "factor"
                      | "gcd"
                      | "integrate"
                      | "intersection"
                      | "inverse"
                      | "interval_probability"
                      | "is_prime"
                      | "lcm"
                      | "limit"
                      | "line"
                      | "linear_system"
                      | "matrix_multiply"
                      | "mean"
                      | "median"
                      | "midpoint"
                      | "mode"
                      | "modular"
                      | "permutation"
                      | "point_probability"
                      | "prime_factorization"
                      | "product"
                      | "quartiles"
                      | "rank"
                      | "rationalize"
                      | "roots"
                      | "rref"
                      | "series"
                      | "simplify"
                      | "slope"
                      | "solve"
                      | "standard_deviation"
                      | "summation"
                      | "tail_probability"
                      | "together"
                      | "variance"
                      | "variance_probability"
                      | "z_score";
                    order?: number;
                    parameters?: {
                      lambda?: string;
                      lower?: string;
                      mean?: string;
                      n?: string;
                      p?: string;
                      standard_deviation?: string;
                      upper?: string;
                    };
                    point?: string;
                    points?: Array<{ x: string; y: string }>;
                    right?: string;
                    right_matrix?: Array<Array<string>>;
                    upper?: string;
                    upperInclusive?: boolean;
                    values?: Array<string>;
                    variable?: string;
                    variables?: Array<string>;
                    vector?: Array<string>;
                  };
                  kind:
                    | "apart"
                    | "cancel"
                    | "circle"
                    | "combination"
                    | "compare"
                    | "cumulative_probability"
                    | "determinant"
                    | "differentiate"
                    | "distance"
                    | "distribution"
                    | "domain"
                    | "eigen_analysis"
                    | "eigenvalues"
                    | "eigenvectors"
                    | "evaluate"
                    | "expected_value"
                    | "expand"
                    | "factor"
                    | "gcd"
                    | "integrate"
                    | "intersection"
                    | "inverse"
                    | "interval_probability"
                    | "is_prime"
                    | "lcm"
                    | "limit"
                    | "line"
                    | "linear_system"
                    | "matrix_multiply"
                    | "mean"
                    | "median"
                    | "midpoint"
                    | "mode"
                    | "modular"
                    | "permutation"
                    | "point_probability"
                    | "prime_factorization"
                    | "product"
                    | "quartiles"
                    | "rank"
                    | "rationalize"
                    | "roots"
                    | "rref"
                    | "series"
                    | "simplify"
                    | "slope"
                    | "solve"
                    | "standard_deviation"
                    | "summation"
                    | "tail_probability"
                    | "together"
                    | "variance"
                    | "variance_probability"
                    | "z_score";
                  status: "loading";
                }
              | {
                  input: {
                    distribution?: string;
                    expression?: string;
                    expressions?: Array<string>;
                    inclusive?: boolean;
                    k?: string;
                    kind: "math";
                    left?: string;
                    lower?: string;
                    lowerInclusive?: boolean;
                    matrix?: Array<Array<string>>;
                    modulus?: string;
                    n?: string;
                    operation:
                      | "apart"
                      | "cancel"
                      | "circle"
                      | "combination"
                      | "compare"
                      | "cumulative_probability"
                      | "determinant"
                      | "differentiate"
                      | "distance"
                      | "distribution"
                      | "domain"
                      | "eigen_analysis"
                      | "eigenvalues"
                      | "eigenvectors"
                      | "evaluate"
                      | "expected_value"
                      | "expand"
                      | "factor"
                      | "gcd"
                      | "integrate"
                      | "intersection"
                      | "inverse"
                      | "interval_probability"
                      | "is_prime"
                      | "lcm"
                      | "limit"
                      | "line"
                      | "linear_system"
                      | "matrix_multiply"
                      | "mean"
                      | "median"
                      | "midpoint"
                      | "mode"
                      | "modular"
                      | "permutation"
                      | "point_probability"
                      | "prime_factorization"
                      | "product"
                      | "quartiles"
                      | "rank"
                      | "rationalize"
                      | "roots"
                      | "rref"
                      | "series"
                      | "simplify"
                      | "slope"
                      | "solve"
                      | "standard_deviation"
                      | "summation"
                      | "tail_probability"
                      | "together"
                      | "variance"
                      | "variance_probability"
                      | "z_score";
                    order?: number;
                    parameters?: {
                      lambda?: string;
                      lower?: string;
                      mean?: string;
                      n?: string;
                      p?: string;
                      standard_deviation?: string;
                      upper?: string;
                    };
                    point?: string;
                    points?: Array<{ x: string; y: string }>;
                    right?: string;
                    right_matrix?: Array<Array<string>>;
                    upper?: string;
                    upperInclusive?: boolean;
                    values?: Array<string>;
                    variable?: string;
                    variables?: Array<string>;
                    vector?: Array<string>;
                  };
                  kind:
                    | "apart"
                    | "cancel"
                    | "circle"
                    | "combination"
                    | "compare"
                    | "cumulative_probability"
                    | "determinant"
                    | "differentiate"
                    | "distance"
                    | "distribution"
                    | "domain"
                    | "eigen_analysis"
                    | "eigenvalues"
                    | "eigenvectors"
                    | "evaluate"
                    | "expected_value"
                    | "expand"
                    | "factor"
                    | "gcd"
                    | "integrate"
                    | "intersection"
                    | "inverse"
                    | "interval_probability"
                    | "is_prime"
                    | "lcm"
                    | "limit"
                    | "line"
                    | "linear_system"
                    | "matrix_multiply"
                    | "mean"
                    | "median"
                    | "midpoint"
                    | "mode"
                    | "modular"
                    | "permutation"
                    | "point_probability"
                    | "prime_factorization"
                    | "product"
                    | "quartiles"
                    | "rank"
                    | "rationalize"
                    | "roots"
                    | "rref"
                    | "series"
                    | "simplify"
                    | "slope"
                    | "solve"
                    | "standard_deviation"
                    | "summation"
                    | "tail_probability"
                    | "together"
                    | "variance"
                    | "variance_probability"
                    | "z_score";
                  result: {
                    conditions: Array<{ expression: string; latex: string }>;
                    input: {
                      distribution?: string;
                      expression?: string;
                      expressions?: Array<string>;
                      inclusive?: boolean;
                      k?: string;
                      kind: "math";
                      left?: string;
                      lower?: string;
                      lowerInclusive?: boolean;
                      matrix?: Array<Array<string>>;
                      modulus?: string;
                      n?: string;
                      operation:
                        | "apart"
                        | "cancel"
                        | "circle"
                        | "combination"
                        | "compare"
                        | "cumulative_probability"
                        | "determinant"
                        | "differentiate"
                        | "distance"
                        | "distribution"
                        | "domain"
                        | "eigen_analysis"
                        | "eigenvalues"
                        | "eigenvectors"
                        | "evaluate"
                        | "expected_value"
                        | "expand"
                        | "factor"
                        | "gcd"
                        | "integrate"
                        | "intersection"
                        | "inverse"
                        | "interval_probability"
                        | "is_prime"
                        | "lcm"
                        | "limit"
                        | "line"
                        | "linear_system"
                        | "matrix_multiply"
                        | "mean"
                        | "median"
                        | "midpoint"
                        | "mode"
                        | "modular"
                        | "permutation"
                        | "point_probability"
                        | "prime_factorization"
                        | "product"
                        | "quartiles"
                        | "rank"
                        | "rationalize"
                        | "roots"
                        | "rref"
                        | "series"
                        | "simplify"
                        | "slope"
                        | "solve"
                        | "standard_deviation"
                        | "summation"
                        | "tail_probability"
                        | "together"
                        | "variance"
                        | "variance_probability"
                        | "z_score";
                      order?: number;
                      parameters?: {
                        lambda?: string;
                        lower?: string;
                        mean?: string;
                        n?: string;
                        p?: string;
                        standard_deviation?: string;
                        upper?: string;
                      };
                      point?: string;
                      points?: Array<{ x: string; y: string }>;
                      right?: string;
                      right_matrix?: Array<Array<string>>;
                      upper?: string;
                      upperInclusive?: boolean;
                      values?: Array<string>;
                      variable?: string;
                      variables?: Array<string>;
                      vector?: Array<string>;
                    };
                    items: Array<{
                      label: string;
                      latex?: string;
                      value: string;
                    }>;
                    kind:
                      | "apart"
                      | "cancel"
                      | "circle"
                      | "combination"
                      | "compare"
                      | "cumulative_probability"
                      | "determinant"
                      | "differentiate"
                      | "distance"
                      | "distribution"
                      | "domain"
                      | "eigen_analysis"
                      | "eigenvalues"
                      | "eigenvectors"
                      | "evaluate"
                      | "expected_value"
                      | "expand"
                      | "factor"
                      | "gcd"
                      | "integrate"
                      | "intersection"
                      | "inverse"
                      | "interval_probability"
                      | "is_prime"
                      | "lcm"
                      | "limit"
                      | "line"
                      | "linear_system"
                      | "matrix_multiply"
                      | "mean"
                      | "median"
                      | "midpoint"
                      | "mode"
                      | "modular"
                      | "permutation"
                      | "point_probability"
                      | "prime_factorization"
                      | "product"
                      | "quartiles"
                      | "rank"
                      | "rationalize"
                      | "roots"
                      | "rref"
                      | "series"
                      | "simplify"
                      | "slope"
                      | "solve"
                      | "standard_deviation"
                      | "summation"
                      | "tail_probability"
                      | "together"
                      | "variance"
                      | "variance_probability"
                      | "z_score";
                    operation:
                      | "apart"
                      | "cancel"
                      | "circle"
                      | "combination"
                      | "compare"
                      | "cumulative_probability"
                      | "determinant"
                      | "differentiate"
                      | "distance"
                      | "distribution"
                      | "domain"
                      | "eigen_analysis"
                      | "eigenvalues"
                      | "eigenvectors"
                      | "evaluate"
                      | "expected_value"
                      | "expand"
                      | "factor"
                      | "gcd"
                      | "integrate"
                      | "intersection"
                      | "inverse"
                      | "interval_probability"
                      | "is_prime"
                      | "lcm"
                      | "limit"
                      | "line"
                      | "linear_system"
                      | "matrix_multiply"
                      | "mean"
                      | "median"
                      | "midpoint"
                      | "mode"
                      | "modular"
                      | "permutation"
                      | "point_probability"
                      | "prime_factorization"
                      | "product"
                      | "quartiles"
                      | "rank"
                      | "rationalize"
                      | "roots"
                      | "rref"
                      | "series"
                      | "simplify"
                      | "slope"
                      | "solve"
                      | "standard_deviation"
                      | "summation"
                      | "tail_probability"
                      | "together"
                      | "variance"
                      | "variance_probability"
                      | "z_score";
                    primary: { expression: string; latex: string };
                    reason: string;
                    secondary?: { expression: string; latex: string };
                    status: "verified" | "contradicted" | "inconclusive";
                    stepStatus: "complete" | "partial" | "unavailable";
                    steps: Array<{
                      action: string;
                      items: Array<{
                        label: string;
                        latex?: string;
                        value: string;
                      }>;
                      primary: { expression: string; latex: string };
                      relation?: { expression: string; latex: string };
                      secondary?: { expression: string; latex: string };
                    }>;
                  };
                  status: "verified" | "contradicted" | "inconclusive";
                  summary: string;
                }
              | {
                  error: string;
                  input: {
                    distribution?: string;
                    expression?: string;
                    expressions?: Array<string>;
                    inclusive?: boolean;
                    k?: string;
                    kind: "math";
                    left?: string;
                    lower?: string;
                    lowerInclusive?: boolean;
                    matrix?: Array<Array<string>>;
                    modulus?: string;
                    n?: string;
                    operation:
                      | "apart"
                      | "cancel"
                      | "circle"
                      | "combination"
                      | "compare"
                      | "cumulative_probability"
                      | "determinant"
                      | "differentiate"
                      | "distance"
                      | "distribution"
                      | "domain"
                      | "eigen_analysis"
                      | "eigenvalues"
                      | "eigenvectors"
                      | "evaluate"
                      | "expected_value"
                      | "expand"
                      | "factor"
                      | "gcd"
                      | "integrate"
                      | "intersection"
                      | "inverse"
                      | "interval_probability"
                      | "is_prime"
                      | "lcm"
                      | "limit"
                      | "line"
                      | "linear_system"
                      | "matrix_multiply"
                      | "mean"
                      | "median"
                      | "midpoint"
                      | "mode"
                      | "modular"
                      | "permutation"
                      | "point_probability"
                      | "prime_factorization"
                      | "product"
                      | "quartiles"
                      | "rank"
                      | "rationalize"
                      | "roots"
                      | "rref"
                      | "series"
                      | "simplify"
                      | "slope"
                      | "solve"
                      | "standard_deviation"
                      | "summation"
                      | "tail_probability"
                      | "together"
                      | "variance"
                      | "variance_probability"
                      | "z_score";
                    order?: number;
                    parameters?: {
                      lambda?: string;
                      lower?: string;
                      mean?: string;
                      n?: string;
                      p?: string;
                      standard_deviation?: string;
                      upper?: string;
                    };
                    point?: string;
                    points?: Array<{ x: string; y: string }>;
                    right?: string;
                    right_matrix?: Array<Array<string>>;
                    upper?: string;
                    upperInclusive?: boolean;
                    values?: Array<string>;
                    variable?: string;
                    variables?: Array<string>;
                    vector?: Array<string>;
                  };
                  kind:
                    | "apart"
                    | "cancel"
                    | "circle"
                    | "combination"
                    | "compare"
                    | "cumulative_probability"
                    | "determinant"
                    | "differentiate"
                    | "distance"
                    | "distribution"
                    | "domain"
                    | "eigen_analysis"
                    | "eigenvalues"
                    | "eigenvectors"
                    | "evaluate"
                    | "expected_value"
                    | "expand"
                    | "factor"
                    | "gcd"
                    | "integrate"
                    | "intersection"
                    | "inverse"
                    | "interval_probability"
                    | "is_prime"
                    | "lcm"
                    | "limit"
                    | "line"
                    | "linear_system"
                    | "matrix_multiply"
                    | "mean"
                    | "median"
                    | "midpoint"
                    | "mode"
                    | "modular"
                    | "permutation"
                    | "point_probability"
                    | "prime_factorization"
                    | "product"
                    | "quartiles"
                    | "rank"
                    | "rationalize"
                    | "roots"
                    | "rref"
                    | "series"
                    | "simplify"
                    | "slope"
                    | "solve"
                    | "standard_deviation"
                    | "summation"
                    | "tail_probability"
                    | "together"
                    | "variance"
                    | "variance_probability"
                    | "z_score";
                  status: "error";
                };
            dataMathId?: string;
            dataNakafaData?:
              | {
                  input: {
                    limit: number;
                    locale: "en" | "id" | "de";
                    offset: number;
                    queries?: Array<string>;
                    section?: "articles" | "material" | "tryout" | "quran";
                  };
                  kind: "search";
                  status: "loading";
                }
              | {
                  input: {
                    limit: number;
                    locale: "en" | "id" | "de";
                    offset: number;
                    queries?: Array<string>;
                    section?: "articles" | "material" | "tryout" | "quran";
                  };
                  kind: "search";
                  result: {
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
                  };
                  status: "done";
                }
              | {
                  error: string;
                  input: {
                    limit: number;
                    locale: "en" | "id" | "de";
                    offset: number;
                    queries?: Array<string>;
                    section?: "articles" | "material" | "tryout" | "quran";
                  };
                  kind: "search";
                  status: "error";
                }
              | {
                  input: { content_ref: string };
                  kind: "content";
                  status: "loading";
                }
              | {
                  input: { content_ref: string };
                  kind: "content";
                  result: {
                    alignmentId: string;
                    assetId: string;
                    conceptId: string;
                    content_id: string;
                    description?: string;
                    learningObjectId: string;
                    lensId: string;
                    locale: "en" | "id" | "de";
                    markdown_url?: string;
                    route: string;
                    section: "articles" | "material" | "tryout" | "quran";
                    title: string;
                    url: string;
                  };
                  status: "done";
                }
              | {
                  error: string;
                  input: { content_ref: string };
                  kind: "content";
                  status: "error";
                }
              | {
                  input: {
                    from_verse: number;
                    include_tafsir: boolean;
                    locale: "en" | "id" | "de";
                    surah: number;
                    to_verse?: number;
                  };
                  kind: "quran";
                  status: "loading";
                }
              | {
                  input: {
                    from_verse: number;
                    include_tafsir: boolean;
                    locale: "en";
                    surah: number;
                    to_verse?: number;
                  };
                  kind: "quran";
                  result: {
                    alignmentId: string;
                    assetId: string;
                    conceptId: string;
                    content_id: string;
                    from_verse: number;
                    learningObjectId: string;
                    lensId: string;
                    locale: "en";
                    markdown_url?: string;
                    meaning: { locale: "en" | "en"; text: string };
                    name: string;
                    revelation: string;
                    route: string;
                    section: "articles" | "material" | "tryout" | "quran";
                    to_verse: number;
                    url: string;
                    verse_count: number;
                  };
                  status: "done";
                }
              | {
                  input: {
                    from_verse: number;
                    include_tafsir: boolean;
                    locale: "id";
                    surah: number;
                    to_verse?: number;
                  };
                  kind: "quran";
                  result: {
                    alignmentId: string;
                    assetId: string;
                    conceptId: string;
                    content_id: string;
                    from_verse: number;
                    learningObjectId: string;
                    lensId: string;
                    locale: "id";
                    markdown_url?: string;
                    meaning: { locale: "id" | "en"; text: string };
                    name: string;
                    revelation: string;
                    route: string;
                    section: "articles" | "material" | "tryout" | "quran";
                    to_verse: number;
                    url: string;
                    verse_count: number;
                  };
                  status: "done";
                }
              | {
                  input: {
                    from_verse: number;
                    include_tafsir: boolean;
                    locale: "de";
                    surah: number;
                    to_verse?: number;
                  };
                  kind: "quran";
                  result: {
                    alignmentId: string;
                    assetId: string;
                    conceptId: string;
                    content_id: string;
                    from_verse: number;
                    learningObjectId: string;
                    lensId: string;
                    locale: "de";
                    markdown_url?: string;
                    meaning: { locale: "de" | "en"; text: string };
                    name: string;
                    revelation: string;
                    route: string;
                    section: "articles" | "material" | "tryout" | "quran";
                    to_verse: number;
                    url: string;
                    verse_count: number;
                  };
                  status: "done";
                }
              | {
                  input: {
                    from_verse: number;
                    include_tafsir: boolean;
                    locale: "en" | "id" | "de";
                    surah: number;
                    to_verse?: number;
                  };
                  kind: "quran";
                  result: {
                    alignmentId: string;
                    assetId: string;
                    conceptId: string;
                    content_id: string;
                    from_verse: number;
                    learningObjectId: string;
                    lensId: string;
                    locale: "en" | "id" | "de";
                    markdown_url?: string;
                    name: string;
                    revelation: string;
                    route: string;
                    section: "articles" | "material" | "tryout" | "quran";
                    to_verse: number;
                    translation: string;
                    url: string;
                    verse_count: number;
                  };
                  status: "done";
                }
              | {
                  error: string;
                  input: {
                    from_verse: number;
                    include_tafsir: boolean;
                    locale: "en" | "id" | "de";
                    surah: number;
                    to_verse?: number;
                  };
                  kind: "quran";
                  status: "error";
                }
              | {
                  input: { locale: "en" | "id" | "de" };
                  kind: "taxonomy";
                  status: "loading";
                }
              | {
                  input: { locale: "en" | "id" | "de" };
                  kind: "taxonomy";
                  result: {
                    content_counts: Array<{
                      count: number;
                      locale: "en" | "id" | "de";
                    }>;
                    locale: "en" | "id" | "de";
                    sections: Array<
                      "articles" | "material" | "tryout" | "quran"
                    >;
                    tools: Array<string>;
                  };
                  status: "done";
                }
              | {
                  error: string;
                  input: { locale: "en" | "id" | "de" };
                  kind: "taxonomy";
                  status: "error";
                };
            dataNakafaId?: string;
            dataScrapeUrlContent?: string;
            dataScrapeUrlDescription?: string;
            dataScrapeUrlError?: string;
            dataScrapeUrlFavicon?: string;
            dataScrapeUrlId?: string;
            dataScrapeUrlStatus?: "loading" | "done" | "error";
            dataScrapeUrlTitle?: string;
            dataScrapeUrlUrl?: string;
            dataSuggestionsData?: Array<string>;
            dataSuggestionsId?: string;
            dataWebSearchError?: string;
            dataWebSearchId?: string;
            dataWebSearchProvider?: "firecrawl" | "google";
            dataWebSearchQueries?: Array<string>;
            dataWebSearchSources?: Array<{
              citation: string;
              content: string;
              description: string;
              title: string;
              url: string;
            }>;
            dataWebSearchStatus?: "loading" | "done" | "error";
            fileFilename?: string;
            fileMediaType?: string;
            fileUrl?: string;
            messageId?: Id<"messages">;
            order: number;
            providerMetadata?: Record<string, Record<string, string>>;
            reasoningState?: "streaming" | "done";
            reasoningText?: string;
            textState?: "streaming" | "done";
            textText?: string;
            toolCallProviderMetadata?: Record<string, Record<string, string>>;
            toolDeepResearchInput?: {
              objective: string;
              request: string;
              requirements?: Array<string>;
              sourceRequirements: Array<string>;
            };
            toolDeepResearchOutput?: string;
            toolErrorText?: string;
            toolMathInput?: {
              given: Array<string>;
              objective: string;
              request: string;
              requirements?: Array<string>;
            };
            toolMathOutput?: string;
            toolNakafaInput?: {
              deliverables: Array<string>;
              objective: string;
              request: string;
              requirements?: Array<string>;
            };
            toolNakafaOutput?: string;
            toolResultProviderMetadata?: Record<string, Record<string, string>>;
            toolState?:
              | "input-streaming"
              | "input-available"
              | "output-available"
              | "output-error";
            toolToolCallId?: string;
            type:
              | "text"
              | "reasoning"
              | "file"
              | "step-start"
              | "tool-nakafa"
              | "tool-deepResearch"
              | "tool-math"
              | "data-suggestions"
              | "data-nakafa"
              | "data-math"
              | "data-scrape-url"
              | "data-web-search";
          }>;
        },
        { messageId: Id<"messages">; partIds: Array<Id<"messageParts">> }
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
        { chatId: Id<"chats"> },
        {
          _creationTime: number;
          _id: Id<"chats">;
          title?: string;
          type: "study";
          updatedAt: number;
          userId: Id<"users">;
          visibility: "private" | "public";
        }
      >;
      getChats: FunctionReference<
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
          userId: Id<"users">;
          visibility?: "private" | "public";
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            _creationTime: number;
            _id: Id<"chats">;
            title?: string;
            type: "study";
            updatedAt: number;
            userId: Id<"users">;
            visibility: "private" | "public";
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
      getChatTitle: FunctionReference<
        "query",
        "public",
        { chatId: Id<"chats"> },
        null | string
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
            title?: string;
            type: "study";
            updatedAt: number;
            userId: Id<"users">;
            visibility: "private" | "public";
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
      getPinnedNinaContextForTurn: FunctionReference<
        "query",
        "public",
        { chatId: Id<"chats">; messageIdentifier: string },
        null | {
          capturedAt: string;
          learning: {
            assetId?: string;
            contentId?: string;
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
          source: "current-page" | "pinned-chat" | "message";
          tools: {
            allowDeepResearch: boolean;
            allowMath: boolean;
            allowNakafa: boolean;
            allowPageFetch: boolean;
            evidenceScope: "verified-page" | "general-learning";
          };
        }
      >;
      loadMessagesPage: FunctionReference<
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
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            _creationTime: number;
            _id: Id<"messages">;
            chatId: Id<"chats">;
            credits?: number;
            generationErrorCode?: "CHAT_RESPONSE_FAILED";
            generationStatus?: "complete" | "failed";
            identifier: string;
            inputTokens?: number;
            modelId?: "nakafa-lite" | "nakafa-pro";
            ninaContextSnapshot?: {
              capturedAt: string;
              learning: {
                assetId?: string;
                contentId?: string;
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
              source: "current-page" | "pinned-chat" | "message";
              tools: {
                allowDeepResearch: boolean;
                allowMath: boolean;
                allowNakafa: boolean;
                allowPageFetch: boolean;
                evidenceScope: "verified-page" | "general-learning";
              };
            };
            ninaContextTransition?: {
              fromContextKey?: string;
              reason: "same-context" | "page-context";
              toContextKey: string;
            };
            outputTokens?: number;
            parts: Array<{
              _creationTime: number;
              _id: Id<"messageParts">;
              dataMathData?:
                | {
                    input: {
                      distribution?: string;
                      expression?: string;
                      expressions?: Array<string>;
                      inclusive?: boolean;
                      k?: string;
                      kind: "math";
                      left?: string;
                      lower?: string;
                      lowerInclusive?: boolean;
                      matrix?: Array<Array<string>>;
                      modulus?: string;
                      n?: string;
                      operation:
                        | "apart"
                        | "cancel"
                        | "circle"
                        | "combination"
                        | "compare"
                        | "cumulative_probability"
                        | "determinant"
                        | "differentiate"
                        | "distance"
                        | "distribution"
                        | "domain"
                        | "eigen_analysis"
                        | "eigenvalues"
                        | "eigenvectors"
                        | "evaluate"
                        | "expected_value"
                        | "expand"
                        | "factor"
                        | "gcd"
                        | "integrate"
                        | "intersection"
                        | "inverse"
                        | "interval_probability"
                        | "is_prime"
                        | "lcm"
                        | "limit"
                        | "line"
                        | "linear_system"
                        | "matrix_multiply"
                        | "mean"
                        | "median"
                        | "midpoint"
                        | "mode"
                        | "modular"
                        | "permutation"
                        | "point_probability"
                        | "prime_factorization"
                        | "product"
                        | "quartiles"
                        | "rank"
                        | "rationalize"
                        | "roots"
                        | "rref"
                        | "series"
                        | "simplify"
                        | "slope"
                        | "solve"
                        | "standard_deviation"
                        | "summation"
                        | "tail_probability"
                        | "together"
                        | "variance"
                        | "variance_probability"
                        | "z_score";
                      order?: number;
                      parameters?: {
                        lambda?: string;
                        lower?: string;
                        mean?: string;
                        n?: string;
                        p?: string;
                        standard_deviation?: string;
                        upper?: string;
                      };
                      point?: string;
                      points?: Array<{ x: string; y: string }>;
                      right?: string;
                      right_matrix?: Array<Array<string>>;
                      upper?: string;
                      upperInclusive?: boolean;
                      values?: Array<string>;
                      variable?: string;
                      variables?: Array<string>;
                      vector?: Array<string>;
                    };
                    kind:
                      | "apart"
                      | "cancel"
                      | "circle"
                      | "combination"
                      | "compare"
                      | "cumulative_probability"
                      | "determinant"
                      | "differentiate"
                      | "distance"
                      | "distribution"
                      | "domain"
                      | "eigen_analysis"
                      | "eigenvalues"
                      | "eigenvectors"
                      | "evaluate"
                      | "expected_value"
                      | "expand"
                      | "factor"
                      | "gcd"
                      | "integrate"
                      | "intersection"
                      | "inverse"
                      | "interval_probability"
                      | "is_prime"
                      | "lcm"
                      | "limit"
                      | "line"
                      | "linear_system"
                      | "matrix_multiply"
                      | "mean"
                      | "median"
                      | "midpoint"
                      | "mode"
                      | "modular"
                      | "permutation"
                      | "point_probability"
                      | "prime_factorization"
                      | "product"
                      | "quartiles"
                      | "rank"
                      | "rationalize"
                      | "roots"
                      | "rref"
                      | "series"
                      | "simplify"
                      | "slope"
                      | "solve"
                      | "standard_deviation"
                      | "summation"
                      | "tail_probability"
                      | "together"
                      | "variance"
                      | "variance_probability"
                      | "z_score";
                    status: "loading";
                  }
                | {
                    input: {
                      distribution?: string;
                      expression?: string;
                      expressions?: Array<string>;
                      inclusive?: boolean;
                      k?: string;
                      kind: "math";
                      left?: string;
                      lower?: string;
                      lowerInclusive?: boolean;
                      matrix?: Array<Array<string>>;
                      modulus?: string;
                      n?: string;
                      operation:
                        | "apart"
                        | "cancel"
                        | "circle"
                        | "combination"
                        | "compare"
                        | "cumulative_probability"
                        | "determinant"
                        | "differentiate"
                        | "distance"
                        | "distribution"
                        | "domain"
                        | "eigen_analysis"
                        | "eigenvalues"
                        | "eigenvectors"
                        | "evaluate"
                        | "expected_value"
                        | "expand"
                        | "factor"
                        | "gcd"
                        | "integrate"
                        | "intersection"
                        | "inverse"
                        | "interval_probability"
                        | "is_prime"
                        | "lcm"
                        | "limit"
                        | "line"
                        | "linear_system"
                        | "matrix_multiply"
                        | "mean"
                        | "median"
                        | "midpoint"
                        | "mode"
                        | "modular"
                        | "permutation"
                        | "point_probability"
                        | "prime_factorization"
                        | "product"
                        | "quartiles"
                        | "rank"
                        | "rationalize"
                        | "roots"
                        | "rref"
                        | "series"
                        | "simplify"
                        | "slope"
                        | "solve"
                        | "standard_deviation"
                        | "summation"
                        | "tail_probability"
                        | "together"
                        | "variance"
                        | "variance_probability"
                        | "z_score";
                      order?: number;
                      parameters?: {
                        lambda?: string;
                        lower?: string;
                        mean?: string;
                        n?: string;
                        p?: string;
                        standard_deviation?: string;
                        upper?: string;
                      };
                      point?: string;
                      points?: Array<{ x: string; y: string }>;
                      right?: string;
                      right_matrix?: Array<Array<string>>;
                      upper?: string;
                      upperInclusive?: boolean;
                      values?: Array<string>;
                      variable?: string;
                      variables?: Array<string>;
                      vector?: Array<string>;
                    };
                    kind:
                      | "apart"
                      | "cancel"
                      | "circle"
                      | "combination"
                      | "compare"
                      | "cumulative_probability"
                      | "determinant"
                      | "differentiate"
                      | "distance"
                      | "distribution"
                      | "domain"
                      | "eigen_analysis"
                      | "eigenvalues"
                      | "eigenvectors"
                      | "evaluate"
                      | "expected_value"
                      | "expand"
                      | "factor"
                      | "gcd"
                      | "integrate"
                      | "intersection"
                      | "inverse"
                      | "interval_probability"
                      | "is_prime"
                      | "lcm"
                      | "limit"
                      | "line"
                      | "linear_system"
                      | "matrix_multiply"
                      | "mean"
                      | "median"
                      | "midpoint"
                      | "mode"
                      | "modular"
                      | "permutation"
                      | "point_probability"
                      | "prime_factorization"
                      | "product"
                      | "quartiles"
                      | "rank"
                      | "rationalize"
                      | "roots"
                      | "rref"
                      | "series"
                      | "simplify"
                      | "slope"
                      | "solve"
                      | "standard_deviation"
                      | "summation"
                      | "tail_probability"
                      | "together"
                      | "variance"
                      | "variance_probability"
                      | "z_score";
                    result: {
                      conditions: Array<{ expression: string; latex: string }>;
                      input: {
                        distribution?: string;
                        expression?: string;
                        expressions?: Array<string>;
                        inclusive?: boolean;
                        k?: string;
                        kind: "math";
                        left?: string;
                        lower?: string;
                        lowerInclusive?: boolean;
                        matrix?: Array<Array<string>>;
                        modulus?: string;
                        n?: string;
                        operation:
                          | "apart"
                          | "cancel"
                          | "circle"
                          | "combination"
                          | "compare"
                          | "cumulative_probability"
                          | "determinant"
                          | "differentiate"
                          | "distance"
                          | "distribution"
                          | "domain"
                          | "eigen_analysis"
                          | "eigenvalues"
                          | "eigenvectors"
                          | "evaluate"
                          | "expected_value"
                          | "expand"
                          | "factor"
                          | "gcd"
                          | "integrate"
                          | "intersection"
                          | "inverse"
                          | "interval_probability"
                          | "is_prime"
                          | "lcm"
                          | "limit"
                          | "line"
                          | "linear_system"
                          | "matrix_multiply"
                          | "mean"
                          | "median"
                          | "midpoint"
                          | "mode"
                          | "modular"
                          | "permutation"
                          | "point_probability"
                          | "prime_factorization"
                          | "product"
                          | "quartiles"
                          | "rank"
                          | "rationalize"
                          | "roots"
                          | "rref"
                          | "series"
                          | "simplify"
                          | "slope"
                          | "solve"
                          | "standard_deviation"
                          | "summation"
                          | "tail_probability"
                          | "together"
                          | "variance"
                          | "variance_probability"
                          | "z_score";
                        order?: number;
                        parameters?: {
                          lambda?: string;
                          lower?: string;
                          mean?: string;
                          n?: string;
                          p?: string;
                          standard_deviation?: string;
                          upper?: string;
                        };
                        point?: string;
                        points?: Array<{ x: string; y: string }>;
                        right?: string;
                        right_matrix?: Array<Array<string>>;
                        upper?: string;
                        upperInclusive?: boolean;
                        values?: Array<string>;
                        variable?: string;
                        variables?: Array<string>;
                        vector?: Array<string>;
                      };
                      items: Array<{
                        label: string;
                        latex?: string;
                        value: string;
                      }>;
                      kind:
                        | "apart"
                        | "cancel"
                        | "circle"
                        | "combination"
                        | "compare"
                        | "cumulative_probability"
                        | "determinant"
                        | "differentiate"
                        | "distance"
                        | "distribution"
                        | "domain"
                        | "eigen_analysis"
                        | "eigenvalues"
                        | "eigenvectors"
                        | "evaluate"
                        | "expected_value"
                        | "expand"
                        | "factor"
                        | "gcd"
                        | "integrate"
                        | "intersection"
                        | "inverse"
                        | "interval_probability"
                        | "is_prime"
                        | "lcm"
                        | "limit"
                        | "line"
                        | "linear_system"
                        | "matrix_multiply"
                        | "mean"
                        | "median"
                        | "midpoint"
                        | "mode"
                        | "modular"
                        | "permutation"
                        | "point_probability"
                        | "prime_factorization"
                        | "product"
                        | "quartiles"
                        | "rank"
                        | "rationalize"
                        | "roots"
                        | "rref"
                        | "series"
                        | "simplify"
                        | "slope"
                        | "solve"
                        | "standard_deviation"
                        | "summation"
                        | "tail_probability"
                        | "together"
                        | "variance"
                        | "variance_probability"
                        | "z_score";
                      operation:
                        | "apart"
                        | "cancel"
                        | "circle"
                        | "combination"
                        | "compare"
                        | "cumulative_probability"
                        | "determinant"
                        | "differentiate"
                        | "distance"
                        | "distribution"
                        | "domain"
                        | "eigen_analysis"
                        | "eigenvalues"
                        | "eigenvectors"
                        | "evaluate"
                        | "expected_value"
                        | "expand"
                        | "factor"
                        | "gcd"
                        | "integrate"
                        | "intersection"
                        | "inverse"
                        | "interval_probability"
                        | "is_prime"
                        | "lcm"
                        | "limit"
                        | "line"
                        | "linear_system"
                        | "matrix_multiply"
                        | "mean"
                        | "median"
                        | "midpoint"
                        | "mode"
                        | "modular"
                        | "permutation"
                        | "point_probability"
                        | "prime_factorization"
                        | "product"
                        | "quartiles"
                        | "rank"
                        | "rationalize"
                        | "roots"
                        | "rref"
                        | "series"
                        | "simplify"
                        | "slope"
                        | "solve"
                        | "standard_deviation"
                        | "summation"
                        | "tail_probability"
                        | "together"
                        | "variance"
                        | "variance_probability"
                        | "z_score";
                      primary: { expression: string; latex: string };
                      reason: string;
                      secondary?: { expression: string; latex: string };
                      status: "verified" | "contradicted" | "inconclusive";
                      stepStatus: "complete" | "partial" | "unavailable";
                      steps: Array<{
                        action: string;
                        items: Array<{
                          label: string;
                          latex?: string;
                          value: string;
                        }>;
                        primary: { expression: string; latex: string };
                        relation?: { expression: string; latex: string };
                        secondary?: { expression: string; latex: string };
                      }>;
                    };
                    status: "verified" | "contradicted" | "inconclusive";
                    summary: string;
                  }
                | {
                    error: string;
                    input: {
                      distribution?: string;
                      expression?: string;
                      expressions?: Array<string>;
                      inclusive?: boolean;
                      k?: string;
                      kind: "math";
                      left?: string;
                      lower?: string;
                      lowerInclusive?: boolean;
                      matrix?: Array<Array<string>>;
                      modulus?: string;
                      n?: string;
                      operation:
                        | "apart"
                        | "cancel"
                        | "circle"
                        | "combination"
                        | "compare"
                        | "cumulative_probability"
                        | "determinant"
                        | "differentiate"
                        | "distance"
                        | "distribution"
                        | "domain"
                        | "eigen_analysis"
                        | "eigenvalues"
                        | "eigenvectors"
                        | "evaluate"
                        | "expected_value"
                        | "expand"
                        | "factor"
                        | "gcd"
                        | "integrate"
                        | "intersection"
                        | "inverse"
                        | "interval_probability"
                        | "is_prime"
                        | "lcm"
                        | "limit"
                        | "line"
                        | "linear_system"
                        | "matrix_multiply"
                        | "mean"
                        | "median"
                        | "midpoint"
                        | "mode"
                        | "modular"
                        | "permutation"
                        | "point_probability"
                        | "prime_factorization"
                        | "product"
                        | "quartiles"
                        | "rank"
                        | "rationalize"
                        | "roots"
                        | "rref"
                        | "series"
                        | "simplify"
                        | "slope"
                        | "solve"
                        | "standard_deviation"
                        | "summation"
                        | "tail_probability"
                        | "together"
                        | "variance"
                        | "variance_probability"
                        | "z_score";
                      order?: number;
                      parameters?: {
                        lambda?: string;
                        lower?: string;
                        mean?: string;
                        n?: string;
                        p?: string;
                        standard_deviation?: string;
                        upper?: string;
                      };
                      point?: string;
                      points?: Array<{ x: string; y: string }>;
                      right?: string;
                      right_matrix?: Array<Array<string>>;
                      upper?: string;
                      upperInclusive?: boolean;
                      values?: Array<string>;
                      variable?: string;
                      variables?: Array<string>;
                      vector?: Array<string>;
                    };
                    kind:
                      | "apart"
                      | "cancel"
                      | "circle"
                      | "combination"
                      | "compare"
                      | "cumulative_probability"
                      | "determinant"
                      | "differentiate"
                      | "distance"
                      | "distribution"
                      | "domain"
                      | "eigen_analysis"
                      | "eigenvalues"
                      | "eigenvectors"
                      | "evaluate"
                      | "expected_value"
                      | "expand"
                      | "factor"
                      | "gcd"
                      | "integrate"
                      | "intersection"
                      | "inverse"
                      | "interval_probability"
                      | "is_prime"
                      | "lcm"
                      | "limit"
                      | "line"
                      | "linear_system"
                      | "matrix_multiply"
                      | "mean"
                      | "median"
                      | "midpoint"
                      | "mode"
                      | "modular"
                      | "permutation"
                      | "point_probability"
                      | "prime_factorization"
                      | "product"
                      | "quartiles"
                      | "rank"
                      | "rationalize"
                      | "roots"
                      | "rref"
                      | "series"
                      | "simplify"
                      | "slope"
                      | "solve"
                      | "standard_deviation"
                      | "summation"
                      | "tail_probability"
                      | "together"
                      | "variance"
                      | "variance_probability"
                      | "z_score";
                    status: "error";
                  };
              dataMathId?: string;
              dataNakafaData?:
                | {
                    input: {
                      limit: number;
                      locale: "en" | "id" | "de";
                      offset: number;
                      queries?: Array<string>;
                      section?: "articles" | "material" | "tryout" | "quran";
                    };
                    kind: "search";
                    status: "loading";
                  }
                | {
                    input: {
                      limit: number;
                      locale: "en" | "id" | "de";
                      offset: number;
                      queries?: Array<string>;
                      section?: "articles" | "material" | "tryout" | "quran";
                    };
                    kind: "search";
                    result: {
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
                    };
                    status: "done";
                  }
                | {
                    error: string;
                    input: {
                      limit: number;
                      locale: "en" | "id" | "de";
                      offset: number;
                      queries?: Array<string>;
                      section?: "articles" | "material" | "tryout" | "quran";
                    };
                    kind: "search";
                    status: "error";
                  }
                | {
                    input: { content_ref: string };
                    kind: "content";
                    status: "loading";
                  }
                | {
                    input: { content_ref: string };
                    kind: "content";
                    result: {
                      alignmentId: string;
                      assetId: string;
                      conceptId: string;
                      content_id: string;
                      description?: string;
                      learningObjectId: string;
                      lensId: string;
                      locale: "en" | "id" | "de";
                      markdown_url?: string;
                      route: string;
                      section: "articles" | "material" | "tryout" | "quran";
                      title: string;
                      url: string;
                    };
                    status: "done";
                  }
                | {
                    error: string;
                    input: { content_ref: string };
                    kind: "content";
                    status: "error";
                  }
                | {
                    input: {
                      from_verse: number;
                      include_tafsir: boolean;
                      locale: "en" | "id" | "de";
                      surah: number;
                      to_verse?: number;
                    };
                    kind: "quran";
                    status: "loading";
                  }
                | {
                    input: {
                      from_verse: number;
                      include_tafsir: boolean;
                      locale: "en";
                      surah: number;
                      to_verse?: number;
                    };
                    kind: "quran";
                    result: {
                      alignmentId: string;
                      assetId: string;
                      conceptId: string;
                      content_id: string;
                      from_verse: number;
                      learningObjectId: string;
                      lensId: string;
                      locale: "en";
                      markdown_url?: string;
                      meaning: { locale: "en" | "en"; text: string };
                      name: string;
                      revelation: string;
                      route: string;
                      section: "articles" | "material" | "tryout" | "quran";
                      to_verse: number;
                      url: string;
                      verse_count: number;
                    };
                    status: "done";
                  }
                | {
                    input: {
                      from_verse: number;
                      include_tafsir: boolean;
                      locale: "id";
                      surah: number;
                      to_verse?: number;
                    };
                    kind: "quran";
                    result: {
                      alignmentId: string;
                      assetId: string;
                      conceptId: string;
                      content_id: string;
                      from_verse: number;
                      learningObjectId: string;
                      lensId: string;
                      locale: "id";
                      markdown_url?: string;
                      meaning: { locale: "id" | "en"; text: string };
                      name: string;
                      revelation: string;
                      route: string;
                      section: "articles" | "material" | "tryout" | "quran";
                      to_verse: number;
                      url: string;
                      verse_count: number;
                    };
                    status: "done";
                  }
                | {
                    input: {
                      from_verse: number;
                      include_tafsir: boolean;
                      locale: "de";
                      surah: number;
                      to_verse?: number;
                    };
                    kind: "quran";
                    result: {
                      alignmentId: string;
                      assetId: string;
                      conceptId: string;
                      content_id: string;
                      from_verse: number;
                      learningObjectId: string;
                      lensId: string;
                      locale: "de";
                      markdown_url?: string;
                      meaning: { locale: "de" | "en"; text: string };
                      name: string;
                      revelation: string;
                      route: string;
                      section: "articles" | "material" | "tryout" | "quran";
                      to_verse: number;
                      url: string;
                      verse_count: number;
                    };
                    status: "done";
                  }
                | {
                    input: {
                      from_verse: number;
                      include_tafsir: boolean;
                      locale: "en" | "id" | "de";
                      surah: number;
                      to_verse?: number;
                    };
                    kind: "quran";
                    result: {
                      alignmentId: string;
                      assetId: string;
                      conceptId: string;
                      content_id: string;
                      from_verse: number;
                      learningObjectId: string;
                      lensId: string;
                      locale: "en" | "id" | "de";
                      markdown_url?: string;
                      name: string;
                      revelation: string;
                      route: string;
                      section: "articles" | "material" | "tryout" | "quran";
                      to_verse: number;
                      translation: string;
                      url: string;
                      verse_count: number;
                    };
                    status: "done";
                  }
                | {
                    error: string;
                    input: {
                      from_verse: number;
                      include_tafsir: boolean;
                      locale: "en" | "id" | "de";
                      surah: number;
                      to_verse?: number;
                    };
                    kind: "quran";
                    status: "error";
                  }
                | {
                    input: { locale: "en" | "id" | "de" };
                    kind: "taxonomy";
                    status: "loading";
                  }
                | {
                    input: { locale: "en" | "id" | "de" };
                    kind: "taxonomy";
                    result: {
                      content_counts: Array<{
                        count: number;
                        locale: "en" | "id" | "de";
                      }>;
                      locale: "en" | "id" | "de";
                      sections: Array<
                        "articles" | "material" | "tryout" | "quran"
                      >;
                      tools: Array<string>;
                    };
                    status: "done";
                  }
                | {
                    error: string;
                    input: { locale: "en" | "id" | "de" };
                    kind: "taxonomy";
                    status: "error";
                  };
              dataNakafaId?: string;
              dataScrapeUrlContent?: string;
              dataScrapeUrlDescription?: string;
              dataScrapeUrlError?: string;
              dataScrapeUrlFavicon?: string;
              dataScrapeUrlId?: string;
              dataScrapeUrlStatus?: "loading" | "done" | "error";
              dataScrapeUrlTitle?: string;
              dataScrapeUrlUrl?: string;
              dataSuggestionsData?: Array<string>;
              dataSuggestionsId?: string;
              dataWebSearchError?: string;
              dataWebSearchId?: string;
              dataWebSearchProvider?: "firecrawl" | "google";
              dataWebSearchQueries?: Array<string>;
              dataWebSearchSources?: Array<{
                citation: string;
                content: string;
                description: string;
                title: string;
                url: string;
              }>;
              dataWebSearchStatus?: "loading" | "done" | "error";
              fileFilename?: string;
              fileMediaType?: string;
              fileUrl?: string;
              messageId: Id<"messages">;
              order: number;
              providerMetadata?: Record<string, Record<string, string>>;
              reasoningState?: "streaming" | "done";
              reasoningText?: string;
              textState?: "streaming" | "done";
              textText?: string;
              toolCallProviderMetadata?: Record<string, Record<string, string>>;
              toolDeepResearchInput?: {
                objective: string;
                request: string;
                requirements?: Array<string>;
                sourceRequirements: Array<string>;
              };
              toolDeepResearchOutput?: string;
              toolErrorText?: string;
              toolMathInput?: {
                given: Array<string>;
                objective: string;
                request: string;
                requirements?: Array<string>;
              };
              toolMathOutput?: string;
              toolNakafaInput?: {
                deliverables: Array<string>;
                objective: string;
                request: string;
                requirements?: Array<string>;
              };
              toolNakafaOutput?: string;
              toolResultProviderMetadata?: Record<
                string,
                Record<string, string>
              >;
              toolState?:
                | "input-streaming"
                | "input-available"
                | "output-available"
                | "output-error";
              toolToolCallId?: string;
              type:
                | "text"
                | "reasoning"
                | "file"
                | "step-start"
                | "tool-nakafa"
                | "tool-deepResearch"
                | "tool-math"
                | "data-suggestions"
                | "data-nakafa"
                | "data-math"
                | "data-scrape-url"
                | "data-web-search";
            }>;
            role: "user" | "assistant" | "system";
            totalTokens?: number;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
    };
    traces: {
      mutations: {
        save: FunctionReference<
          "mutation",
          "public",
          {
            chatId: Id<"chats">;
            trace: {
              capability: "nakafa" | "deepResearch" | "math";
              durationMs: number;
              endedAt: number;
              evidence: {
                capability: "nakafa" | "deepResearch" | "math";
                limitations?: Array<string>;
                refs?: Array<string>;
                status: "available" | "limited" | "failed" | "denied";
                summary: string;
              };
              responseMessageIdentifier: string;
              startedAt: number;
              toolCallId?: string;
            };
          },
          Id<"ninaCapabilityTraces">
        >;
      };
      queries: {
        list: FunctionReference<
          "query",
          "public",
          {
            chatId: Id<"chats">;
            limit?: number;
            responseMessageIdentifier?: string;
          },
          Array<{
            _creationTime: number;
            _id: Id<"ninaCapabilityTraces">;
            capability: "nakafa" | "deepResearch" | "math";
            chatId: Id<"chats">;
            durationMs: number;
            endedAt: number;
            evidence: {
              capability: "nakafa" | "deepResearch" | "math";
              limitations?: Array<string>;
              refs?: Array<string>;
              status: "available" | "limited" | "failed" | "denied";
              summary: string;
            };
            expiresAt: number;
            responseMessageIdentifier: string;
            startedAt: number;
            status: "available" | "limited" | "failed" | "denied";
            toolCallId?: string;
            userId: Id<"users">;
          }>
        >;
      };
    };
  };
  classes: {
    forums: {
      mutations: {
        forums: {
          createForum: FunctionReference<
            "mutation",
            "public",
            {
              body: string;
              classId: Id<"schoolClasses">;
              tag:
                | "general"
                | "question"
                | "announcement"
                | "assignment"
                | "resource";
              title: string;
            },
            Id<"schoolClassForums">
          >;
        };
        posts: {
          createForumPost: FunctionReference<
            "mutation",
            "public",
            {
              attachmentUploadIds?: Array<Id<"schoolClassForumPendingUploads">>;
              body: string;
              forumId: Id<"schoolClassForums">;
              mentions?: Array<Id<"users">>;
              parentId?: Id<"schoolClassForumPosts">;
            },
            Id<"schoolClassForumPosts">
          >;
        };
        reactions: {
          toggleForumReaction: FunctionReference<
            "mutation",
            "public",
            { emoji: string; forumId: Id<"schoolClassForums"> },
            { added: boolean }
          >;
          togglePostReaction: FunctionReference<
            "mutation",
            "public",
            { emoji: string; postId: Id<"schoolClassForumPosts"> },
            { added: boolean }
          >;
        };
        readState: {
          markForumRead: FunctionReference<
            "mutation",
            "public",
            {
              forumId: Id<"schoolClassForums">;
              lastReadPostId: Id<"schoolClassForumPosts">;
            },
            null
          >;
        };
        uploads: {
          discardForumUploads: FunctionReference<
            "mutation",
            "public",
            { uploadIds: Array<Id<"schoolClassForumPendingUploads">> },
            null
          >;
          generateUploadUrl: FunctionReference<
            "mutation",
            "public",
            { forumId: Id<"schoolClassForums"> },
            {
              uploadId: Id<"schoolClassForumPendingUploads">;
              uploadUrl: string;
            }
          >;
          saveForumUpload: FunctionReference<
            "mutation",
            "public",
            {
              name: string;
              size: number;
              storageId: Id<"_storage">;
              type: string;
              uploadId: Id<"schoolClassForumPendingUploads">;
            },
            Id<"schoolClassForumPendingUploads">
          >;
        };
      };
      queries: {
        forums: {
          getForum: FunctionReference<
            "query",
            "public",
            { forumId: Id<"schoolClassForums"> },
            {
              _creationTime: number;
              _id: Id<"schoolClassForums">;
              body: string;
              classId: Id<"schoolClasses">;
              createdBy: Id<"users">;
              isPinned: boolean;
              lastPostAt: number;
              lastPostBy?: Id<"users">;
              myReactions: Array<string>;
              nextPostSequence: number;
              postCount: number;
              reactionCounts: Array<{ count: number; emoji: string }>;
              reactionUsers: Array<{
                count: number;
                emoji: string;
                reactors: Array<string>;
              }>;
              schoolId: Id<"schools">;
              status: "open" | "locked" | "archived";
              tag:
                | "general"
                | "question"
                | "announcement"
                | "assignment"
                | "resource";
              title: string;
              updatedAt: number;
              user: null | {
                _id: Id<"users">;
                email: string;
                image?: null | string;
                name: string;
              };
            }
          >;
          getForums: FunctionReference<
            "query",
            "public",
            {
              classId: Id<"schoolClasses">;
              paginationOpts: {
                cursor: string | null;
                endCursor?: string | null;
                id?: number;
                maximumBytesRead?: number;
                maximumRowsRead?: number;
                numItems: number;
              };
              q?: string;
            },
            {
              continueCursor: string;
              isDone: boolean;
              page: Array<{
                _creationTime: number;
                _id: Id<"schoolClassForums">;
                body: string;
                classId: Id<"schoolClasses">;
                createdBy: Id<"users">;
                isPinned: boolean;
                lastPostAt: number;
                lastPostBy?: Id<"users">;
                myReactions: Array<string>;
                nextPostSequence: number;
                postCount: number;
                reactionCounts: Array<{ count: number; emoji: string }>;
                schoolId: Id<"schools">;
                status: "open" | "locked" | "archived";
                tag:
                  | "general"
                  | "question"
                  | "announcement"
                  | "assignment"
                  | "resource";
                title: string;
                unreadCount: number;
                updatedAt: number;
                user: null | {
                  _id: Id<"users">;
                  email: string;
                  image?: null | string;
                  name: string;
                };
              }>;
              pageStatus?: "SplitRecommended" | "SplitRequired" | null;
              splitCursor?: string | null;
            }
          >;
        };
        pages: {
          getForumPosts: FunctionReference<
            "query",
            "public",
            { forumId: Id<"schoolClassForums"> },
            Array<{
              _creationTime: number;
              _id: Id<"schoolClassForumPosts">;
              attachments: Array<{
                _id: Id<"schoolClassForumPostAttachments">;
                mimeType: string;
                name: string;
                size: number;
                url: null | string;
              }>;
              body: string;
              classId: Id<"schoolClasses">;
              createdBy: Id<"users">;
              editedAt?: number;
              forumId: Id<"schoolClassForums">;
              isUnread: boolean;
              mentions: Array<Id<"users">>;
              myReactions: Array<string>;
              parentId?: Id<"schoolClassForumPosts">;
              reactionCounts: Array<{ count: number; emoji: string }>;
              reactionUsers: Array<{
                count: number;
                emoji: string;
                reactors: Array<string>;
              }>;
              replyCount: number;
              replyToBody?: string;
              replyToUser: null | {
                _id: Id<"users">;
                email: string;
                image?: null | string;
                name: string;
              };
              replyToUserId?: Id<"users">;
              sequence: number;
              updatedAt: number;
              user: null | {
                _id: Id<"users">;
                email: string;
                image?: null | string;
                name: string;
              };
            }>
          >;
        };
      };
    };
    materials: {
      mutations: {
        createMaterialGroup: FunctionReference<
          "mutation",
          "public",
          {
            classId: Id<"schoolClasses">;
            description: string;
            name: string;
            scheduledAt?: number;
            status: "draft" | "published" | "scheduled" | "archived";
          },
          Id<"schoolClassMaterialGroups">
        >;
        deleteMaterialGroup: FunctionReference<
          "mutation",
          "public",
          { groupId: Id<"schoolClassMaterialGroups"> },
          null
        >;
        reorderMaterialGroup: FunctionReference<
          "mutation",
          "public",
          {
            direction: "up" | "down";
            groupId: Id<"schoolClassMaterialGroups">;
          },
          null
        >;
        updateMaterialGroup: FunctionReference<
          "mutation",
          "public",
          {
            description?: string;
            groupId: Id<"schoolClassMaterialGroups">;
            name?: string;
            scheduledAt?: number;
            status?: "draft" | "published" | "scheduled" | "archived";
          },
          Id<"schoolClassMaterialGroups">
        >;
      };
      queries: {
        getMaterialGroups: FunctionReference<
          "query",
          "public",
          {
            classId: Id<"schoolClasses">;
            paginationOpts: {
              cursor: string | null;
              endCursor?: string | null;
              id?: number;
              maximumBytesRead?: number;
              maximumRowsRead?: number;
              numItems: number;
            };
            parentId?: Id<"schoolClassMaterialGroups">;
            q?: string;
          },
          {
            continueCursor: string;
            isDone: boolean;
            page: Array<{
              _creationTime: number;
              _id: Id<"schoolClassMaterialGroups">;
              childGroupCount: number;
              classId: Id<"schoolClasses">;
              createdBy: Id<"users">;
              description: string;
              materialCount: number;
              name: string;
              order: number;
              parentId?: Id<"schoolClassMaterialGroups">;
              publishedAt?: number;
              publishedBy?: Id<"users">;
              publishedByUser: null | {
                _id: Id<"users">;
                email: string;
                image?: null | string;
                name: string;
              };
              scheduledAt?: number;
              scheduledJobId?: Id<"_scheduled_functions">;
              schoolId: Id<"schools">;
              status: "draft" | "published" | "scheduled" | "archived";
              updatedAt: number;
              user: null | {
                _id: Id<"users">;
                email: string;
                image?: null | string;
                name: string;
              };
            }>;
            pageStatus?: "SplitRecommended" | "SplitRequired" | null;
            splitCursor?: string | null;
          }
        >;
      };
    };
    mutations: {
      createClass: FunctionReference<
        "mutation",
        "public",
        {
          name: string;
          schoolId: Id<"schools">;
          subject: string;
          visibility: "private" | "public";
          year: string;
        },
        Id<"schoolClasses">
      >;
      joinClass: FunctionReference<
        "mutation",
        "public",
        { code: string },
        { classId: Id<"schoolClasses"> }
      >;
      joinPublicClass: FunctionReference<
        "mutation",
        "public",
        { classId: Id<"schoolClasses"> },
        { classId: Id<"schoolClasses"> }
      >;
      updateClassImage: FunctionReference<
        "mutation",
        "public",
        {
          classId: Id<"schoolClasses">;
          image:
            | "retro"
            | "time"
            | "stars"
            | "chill"
            | "puzzle"
            | "line"
            | "shoot"
            | "virus"
            | "bacteria"
            | "cooking"
            | "disco"
            | "logic"
            | "ball"
            | "duck"
            | "music"
            | "nightly"
            | "writer"
            | "barbie"
            | "fun"
            | "lamp"
            | "lemon"
            | "nighty"
            | "rocket"
            | "sakura"
            | "sky"
            | "stamp"
            | "vintage";
        },
        null
      >;
      updateClassVisibility: FunctionReference<
        "mutation",
        "public",
        { classId: Id<"schoolClasses">; visibility: "private" | "public" },
        null
      >;
    };
    queries: {
      getClasses: FunctionReference<
        "query",
        "public",
        {
          isArchived?: boolean;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          q?: string;
          schoolId: Id<"schools">;
          visibility?: "private" | "public";
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            _creationTime: number;
            _id: Id<"schoolClasses">;
            archivedAt?: number;
            archivedBy?: Id<"users">;
            createdBy: Id<"users">;
            image:
              | "retro"
              | "time"
              | "stars"
              | "chill"
              | "puzzle"
              | "line"
              | "shoot"
              | "virus"
              | "bacteria"
              | "cooking"
              | "disco"
              | "logic"
              | "ball"
              | "duck"
              | "music"
              | "nightly"
              | "writer"
              | "barbie"
              | "fun"
              | "lamp"
              | "lemon"
              | "nighty"
              | "rocket"
              | "sakura"
              | "sky"
              | "stamp"
              | "vintage";
            isArchived: boolean;
            name: string;
            schoolId: Id<"schools">;
            studentCount: number;
            subject: string;
            teacherCount: number;
            updatedAt: number;
            updatedBy?: Id<"users">;
            visibility: "private" | "public";
            year: string;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
      getClassRoute: FunctionReference<
        "query",
        "public",
        { classId: string },
        | {
            class: {
              _creationTime: number;
              _id: Id<"schoolClasses">;
              archivedAt?: number;
              archivedBy?: Id<"users">;
              createdBy: Id<"users">;
              image:
                | "retro"
                | "time"
                | "stars"
                | "chill"
                | "puzzle"
                | "line"
                | "shoot"
                | "virus"
                | "bacteria"
                | "cooking"
                | "disco"
                | "logic"
                | "ball"
                | "duck"
                | "music"
                | "nightly"
                | "writer"
                | "barbie"
                | "fun"
                | "lamp"
                | "lemon"
                | "nighty"
                | "rocket"
                | "sakura"
                | "sky"
                | "stamp"
                | "vintage";
              isArchived: boolean;
              name: string;
              schoolId: Id<"schools">;
              studentCount: number;
              subject: string;
              teacherCount: number;
              updatedAt: number;
              updatedBy?: Id<"users">;
              visibility: "private" | "public";
              year: string;
            };
            classMembership: null | {
              _creationTime: number;
              _id: Id<"schoolClassMembers">;
              addedBy?: Id<"users">;
              classId: Id<"schoolClasses">;
              enrollMethod?:
                "by_code" | "teacher" | "admin" | "invite" | "public";
              inviteCodeId?: Id<"schoolClassInviteCodes">;
              removedAt?: number;
              removedBy?: Id<"users">;
              role: "teacher" | "student";
              schoolId: Id<"schools">;
              teacherRole?: "primary" | "co-teacher" | "assistant";
              updatedAt: number;
              userId: Id<"users">;
            };
            kind: "accessible";
            schoolMembership: {
              _creationTime: number;
              _id: Id<"schoolMembers">;
              inviteCodeId?: Id<"schoolInviteCodes">;
              inviteToken?: string;
              invitedAt?: number;
              invitedBy?: Id<"users">;
              joinedAt: number;
              removedAt?: number;
              removedBy?: Id<"users">;
              role: "admin" | "teacher" | "student" | "parent" | "demo";
              schoolId: Id<"schools">;
              status: "active" | "invited" | "removed";
              updatedAt: number;
              userId: Id<"users">;
            };
          }
        | {
            class: {
              _id: Id<"schoolClasses">;
              image:
                | "retro"
                | "time"
                | "stars"
                | "chill"
                | "puzzle"
                | "line"
                | "shoot"
                | "virus"
                | "bacteria"
                | "cooking"
                | "disco"
                | "logic"
                | "ball"
                | "duck"
                | "music"
                | "nightly"
                | "writer"
                | "barbie"
                | "fun"
                | "lamp"
                | "lemon"
                | "nighty"
                | "rocket"
                | "sakura"
                | "sky"
                | "stamp"
                | "vintage";
              name: string;
              subject: string;
              visibility: "private" | "public";
              year: string;
            };
            kind: "joinRequired";
            schoolMembership: {
              _creationTime: number;
              _id: Id<"schoolMembers">;
              inviteCodeId?: Id<"schoolInviteCodes">;
              inviteToken?: string;
              invitedAt?: number;
              invitedBy?: Id<"users">;
              joinedAt: number;
              removedAt?: number;
              removedBy?: Id<"users">;
              role: "admin" | "teacher" | "student" | "parent" | "demo";
              schoolId: Id<"schools">;
              status: "active" | "invited" | "removed";
              updatedAt: number;
              userId: Id<"users">;
            };
          }
      >;
      getInviteCodes: FunctionReference<
        "query",
        "public",
        { classId: Id<"schoolClasses"> },
        Array<{
          _creationTime: number;
          _id: Id<"schoolClassInviteCodes">;
          classId: Id<"schoolClasses">;
          code: string;
          createdBy: Id<"users">;
          currentUsage: number;
          description?: string;
          enabled: boolean;
          expiresAt?: number;
          maxUsage?: number;
          role: "teacher" | "student";
          schoolId: Id<"schools">;
          updatedAt: number;
          updatedBy?: Id<"users">;
        }>
      >;
      getPeople: FunctionReference<
        "query",
        "public",
        {
          classId: Id<"schoolClasses">;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          q?: string;
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            _creationTime: number;
            _id: Id<"schoolClassMembers">;
            addedBy?: Id<"users">;
            classId: Id<"schoolClasses">;
            enrollMethod?:
              "by_code" | "teacher" | "admin" | "invite" | "public";
            inviteCodeId?: Id<"schoolClassInviteCodes">;
            removedAt?: number;
            removedBy?: Id<"users">;
            role: "teacher" | "student";
            schoolId: Id<"schools">;
            teacherRole?: "primary" | "co-teacher" | "assistant";
            updatedAt: number;
            user: {
              _id: Id<"users">;
              email: string;
              image?: null | string;
              name: string;
            };
            userId: Id<"users">;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
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
      voteOnComment: FunctionReference<
        "mutation",
        "public",
        { commentId: Id<"comments">; vote: -1 | 0 | 1 },
        null
      >;
    };
    queries: {
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
            downvoteCount: number;
            parentId?: Id<"comments">;
            replyCount: number;
            replyToText?: string;
            replyToUser: null | {
              _id: Id<"users">;
              image?: null | string;
              name: string;
            };
            replyToUserId?: Id<"users">;
            slug: string;
            text: string;
            upvoteCount: number;
            user: null | {
              _id: Id<"users">;
              image?: null | string;
              name: string;
            };
            userId: Id<"users">;
            viewerVote: null | -1 | 1;
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
            downvoteCount: number;
            parentId?: Id<"comments">;
            replyCount: number;
            replyToText?: string;
            replyToUserId?: Id<"users">;
            slug: string;
            text: string;
            upvoteCount: number;
            userId: Id<"users">;
            viewerVote: null | -1 | 1;
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
      delivery: FunctionReference<
        "query",
        "public",
        { appLocale: "en" | "id" | "de"; publicPath: string },
        {
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
            siblingJson: Array<string>;
            sourcePath: string | null;
            sourceRevision: string | null;
          };
          runtimeJson: string | null;
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
        { appLocale: "en" | "id" | "de"; bucket: string },
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
            deviceId: string;
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
          {
            limit?: number;
            locale: "en" | "id" | "de";
            minViews?: number;
            windowKey?:
              | "1d"
              | "7d"
              | "14d"
              | "30d"
              | "90d"
              | "180d"
              | "365d"
              | "lifetime";
          },
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
            viewCount: number;
          }>
        >;
      };
    };
  };
  customers: {
    actions: {
      public: {
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
  notifications: {
    mutations: {
      setDisabledNotificationTypes: FunctionReference<
        "mutation",
        "public",
        {
          disabledTypes: Array<
            | "forum_mention"
            | "forum_reply"
            | "forum_reaction"
            | "post_mention"
            | "post_reply"
            | "post_reaction"
            | "comment_reply"
            | "comment_mention"
            | "comment_upvote"
            | "class_joined"
            | "class_announcement"
            | "class_assignment"
            | "class_removed"
            | "school_invite"
            | "school_joined"
            | "school_role_changed"
            | "school_removed"
            | "system"
          >;
        },
        null
      >;
      setNotificationEntityMute: FunctionReference<
        "mutation",
        "public",
        {
          entityId:
            | Id<"schoolClassForums">
            | Id<"schoolClassForumPosts">
            | Id<"schoolClasses">
            | Id<"schools">
            | Id<"comments">;
          entityType:
            | "schoolClassForums"
            | "schoolClassForumPosts"
            | "schoolClasses"
            | "schools"
            | "comments"
            | "system";
          muted: boolean;
        },
        null
      >;
      updateNotificationPreferences: FunctionReference<
        "mutation",
        "public",
        { emailDigest: "daily" | "weekly" | "never"; emailEnabled: boolean },
        null
      >;
    };
    queries: {
      getNotificationPreferences: FunctionReference<
        "query",
        "public",
        {},
        {
          disabledTypes: Array<
            | "forum_mention"
            | "forum_reply"
            | "forum_reaction"
            | "post_mention"
            | "post_reply"
            | "post_reaction"
            | "comment_reply"
            | "comment_mention"
            | "comment_upvote"
            | "class_joined"
            | "class_announcement"
            | "class_assignment"
            | "class_removed"
            | "school_invite"
            | "school_joined"
            | "school_role_changed"
            | "school_removed"
            | "system"
          >;
          emailDigest: "daily" | "weekly" | "never";
          emailEnabled: boolean;
        }
      >;
      listMutedNotificationEntities: FunctionReference<
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
            entityId:
              | Id<"schoolClassForums">
              | Id<"schoolClassForumPosts">
              | Id<"schoolClasses">
              | Id<"schools">
              | Id<"comments">;
            entityType:
              | "schoolClassForums"
              | "schoolClassForumPosts"
              | "schoolClasses"
              | "schools"
              | "comments"
              | "system";
            mutedAt: number;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
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
            | { kind: "curriculum-index" }
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
  schools: {
    mutations: {
      createSchool: FunctionReference<
        "mutation",
        "public",
        {
          address: string;
          city: string;
          email: string;
          name: string;
          phone: string;
          province: string;
          type:
            | "elementary-school"
            | "middle-school"
            | "high-school"
            | "vocational-school"
            | "university"
            | "other";
        },
        { schoolId: Id<"schools">; slug: string }
      >;
      joinSchool: FunctionReference<
        "mutation",
        "public",
        { code: string },
        { schoolId: Id<"schools">; slug: string }
      >;
    };
    queries: {
      getMySchoolLandingState: FunctionReference<
        "query",
        "public",
        {},
        | { kind: "none" }
        | { kind: "single"; slug: string }
        | { kind: "multiple" }
      >;
      getMySchoolsPage: FunctionReference<
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
            _id: Id<"schools">;
            name: string;
            slug: string;
            type:
              | "elementary-school"
              | "middle-school"
              | "high-school"
              | "vocational-school"
              | "university"
              | "other";
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
      getSchoolBySlug: FunctionReference<
        "query",
        "public",
        { slug: string },
        {
          membership: {
            _creationTime: number;
            _id: Id<"schoolMembers">;
            inviteCodeId?: Id<"schoolInviteCodes">;
            inviteToken?: string;
            invitedAt?: number;
            invitedBy?: Id<"users">;
            joinedAt: number;
            removedAt?: number;
            removedBy?: Id<"users">;
            role: "admin" | "teacher" | "student" | "parent" | "demo";
            schoolId: Id<"schools">;
            status: "active" | "invited" | "removed";
            updatedAt: number;
            userId: Id<"users">;
          };
          school: {
            _creationTime: number;
            _id: Id<"schools">;
            address?: string;
            city: string;
            createdBy: Id<"users">;
            currentStudents: number;
            currentTeachers: number;
            email: string;
            name: string;
            phone?: string;
            province: string;
            slug: string;
            type:
              | "elementary-school"
              | "middle-school"
              | "high-school"
              | "vocational-school"
              | "university"
              | "other";
            updatedAt: number;
            updatedBy?: Id<"users">;
          };
        }
      >;
    };
  };
  subscriptions: {
    queries: {
      hasActiveSubscription: FunctionReference<
        "query",
        "public",
        { productId: string },
        boolean
      >;
    };
  };
  tryouts: {
    mutations: {
      access: {
        trackPaywallView: FunctionReference<
          "mutation",
          "public",
          { source: "access-query" | "start-mutation" },
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
              | null;
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
          | { kind: "free-attempt" }
          | { kind: "included" }
          | { kind: "upgrade-required" }
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
                    scoringStrategy: "irt" | "raw" | "weighted";
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
                      scoringStrategy: "irt" | "raw" | "weighted";
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
                      selection:
                        | { kind: "single-choice"; optionKey: string }
                        | { kind: "multiple-choice"; optionKeys: Array<string> }
                        | {
                            assignments: Array<{
                              categoryKey: string;
                              statementKey: string;
                            }>;
                            kind: "category";
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
                        };
                    sourcePath: string;
                    sourceRevision: string;
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
                      scoringStrategy: "irt" | "raw" | "weighted";
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
                  scoringStrategy: "irt" | "raw" | "weighted";
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
                  scoringStrategy: "irt" | "raw" | "weighted";
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
                  readySetCount: number;
                  readyVisibleSectionCount: number;
                  title: string;
                  trackKey: string;
                  trackKind: "subject" | "year";
                };
              };
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
                    scoringStrategy: "irt" | "raw" | "weighted";
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
                      scoringStrategy: "irt" | "raw" | "weighted";
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
                      selection:
                        | { kind: "single-choice"; optionKey: string }
                        | { kind: "multiple-choice"; optionKeys: Array<string> }
                        | {
                            assignments: Array<{
                              categoryKey: string;
                              statementKey: string;
                            }>;
                            kind: "category";
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
                        };
                    sourcePath: string;
                    sourceRevision: string;
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
                      scoringStrategy: "irt" | "raw" | "weighted";
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
                  scoringStrategy: "irt" | "raw" | "weighted";
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
                  scoringStrategy: "irt" | "raw" | "weighted";
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
                  readySetCount: number;
                  readyVisibleSectionCount: number;
                  title: string;
                  trackKey: string;
                  trackKind: "subject" | "year";
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
                    scoringStrategy: "irt" | "raw" | "weighted";
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
                      scoringStrategy: "irt" | "raw" | "weighted";
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
                      selection:
                        | { kind: "single-choice"; optionKey: string }
                        | { kind: "multiple-choice"; optionKeys: Array<string> }
                        | {
                            assignments: Array<{
                              categoryKey: string;
                              statementKey: string;
                            }>;
                            kind: "category";
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
                        };
                    sourcePath: string;
                    sourceRevision: string;
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
                      scoringStrategy: "irt" | "raw" | "weighted";
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
                  scoringStrategy: "irt" | "raw" | "weighted";
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
                  scoringStrategy: "irt" | "raw" | "weighted";
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
                  readySetCount: number;
                  readyVisibleSectionCount: number;
                  title: string;
                  trackKey: string;
                  trackKind: "subject" | "year";
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
              scoringStrategy: "irt" | "raw" | "weighted";
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
              scoringStrategy: "irt" | "raw" | "weighted";
              title: string;
            };
            tracks: Array<{
              description?: string;
              publicPath: string;
              readyQuestionCount: number;
              readySetCount: number;
              readyVisibleSectionCount: number;
              title: string;
              trackKey: string;
              trackKind: "subject" | "year";
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
              scoringStrategy: "irt" | "raw" | "weighted";
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
              scoringStrategy: "irt" | "raw" | "weighted";
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
              readySetCount: number;
              readyVisibleSectionCount: number;
              title: string;
              trackKey: string;
              trackKind: "subject" | "year";
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
              scoringStrategy: "irt" | "raw" | "weighted";
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
              scoringStrategy: "irt" | "raw" | "weighted";
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
              readySetCount: number;
              readyVisibleSectionCount: number;
              title: string;
              trackKey: string;
              trackKind: "subject" | "year";
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
              scoringStrategy: "irt" | "raw" | "weighted";
              title: string;
            };
            track: {
              description?: string;
              publicPath: string;
              readyQuestionCount: number;
              readySetCount: number;
              readyVisibleSectionCount: number;
              title: string;
              trackKey: string;
              trackKind: "subject" | "year";
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
                scoringStrategy: "irt" | "raw" | "weighted";
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
          { attemptId: Id<"tryoutAttempts">; sectionKey: string },
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
                scoringStrategy: "irt" | "raw" | "weighted";
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
                  scoringStrategy: "irt" | "raw" | "weighted";
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
                  selection:
                    | { kind: "single-choice"; optionKey: string }
                    | { kind: "multiple-choice"; optionKeys: Array<string> }
                    | {
                        assignments: Array<{
                          categoryKey: string;
                          statementKey: string;
                        }>;
                        kind: "category";
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
                    };
                sourcePath: string;
                sourceRevision: string;
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
                  scoringStrategy: "irt" | "raw" | "weighted";
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
          { attemptId: Id<"tryoutAttempts"> },
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
                scoringStrategy: "irt" | "raw" | "weighted";
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
                  scoringStrategy: "irt" | "raw" | "weighted";
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
                  selection:
                    | { kind: "single-choice"; optionKey: string }
                    | { kind: "multiple-choice"; optionKeys: Array<string> }
                    | {
                        assignments: Array<{
                          categoryKey: string;
                          statementKey: string;
                        }>;
                        kind: "category";
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
                    };
                sourcePath: string;
                sourceRevision: string;
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
                  scoringStrategy: "irt" | "raw" | "weighted";
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
              scoringStrategy: "irt" | "raw" | "weighted";
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
      syncUserInfoForChat: FunctionReference<
        "mutation",
        "public",
        {},
        {
          credits: number;
          role:
            null | null | "teacher" | "student" | "parent" | "administrator";
          userId: Id<"users">;
        }
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
        boolean
      >;
      claimAccountDeletion: FunctionReference<
        "mutation",
        "internal",
        { attemptId: string; authId: string },
        | "continue"
        | "ready"
        | "school-successor-required"
        | "temporarily-unavailable"
      >;
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
  chats: {
    assistantResponses: {
      saveAssistantFailure: FunctionReference<
        "mutation",
        "internal",
        {
          message: {
            chatId: Id<"chats">;
            generationErrorCode: "CHAT_RESPONSE_FAILED";
            identifier: string;
            modelId: "nakafa-lite" | "nakafa-pro";
          };
          userId: Id<"users">;
        },
        null | { messageId: Id<"messages"> }
      >;
      saveAssistantResponse: FunctionReference<
        "mutation",
        "internal",
        {
          message: {
            chatId: Id<"chats">;
            credits?: number;
            generationErrorCode?: "CHAT_RESPONSE_FAILED";
            generationStatus?: "complete" | "failed";
            identifier: string;
            inputTokens?: number;
            modelId?: "nakafa-lite" | "nakafa-pro";
            ninaContextSnapshot?: {
              capturedAt: string;
              learning: {
                assetId?: string;
                contentId?: string;
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
              source: "current-page" | "pinned-chat" | "message";
              tools: {
                allowDeepResearch: boolean;
                allowMath: boolean;
                allowNakafa: boolean;
                allowPageFetch: boolean;
                evidenceScope: "verified-page" | "general-learning";
              };
            };
            ninaContextTransition?: {
              fromContextKey?: string;
              reason: "same-context" | "page-context";
              toContextKey: string;
            };
            outputTokens?: number;
            role: "user" | "assistant" | "system";
            totalTokens?: number;
          };
          parts: Array<{
            dataMathData?:
              | {
                  input: {
                    distribution?: string;
                    expression?: string;
                    expressions?: Array<string>;
                    inclusive?: boolean;
                    k?: string;
                    kind: "math";
                    left?: string;
                    lower?: string;
                    lowerInclusive?: boolean;
                    matrix?: Array<Array<string>>;
                    modulus?: string;
                    n?: string;
                    operation:
                      | "apart"
                      | "cancel"
                      | "circle"
                      | "combination"
                      | "compare"
                      | "cumulative_probability"
                      | "determinant"
                      | "differentiate"
                      | "distance"
                      | "distribution"
                      | "domain"
                      | "eigen_analysis"
                      | "eigenvalues"
                      | "eigenvectors"
                      | "evaluate"
                      | "expected_value"
                      | "expand"
                      | "factor"
                      | "gcd"
                      | "integrate"
                      | "intersection"
                      | "inverse"
                      | "interval_probability"
                      | "is_prime"
                      | "lcm"
                      | "limit"
                      | "line"
                      | "linear_system"
                      | "matrix_multiply"
                      | "mean"
                      | "median"
                      | "midpoint"
                      | "mode"
                      | "modular"
                      | "permutation"
                      | "point_probability"
                      | "prime_factorization"
                      | "product"
                      | "quartiles"
                      | "rank"
                      | "rationalize"
                      | "roots"
                      | "rref"
                      | "series"
                      | "simplify"
                      | "slope"
                      | "solve"
                      | "standard_deviation"
                      | "summation"
                      | "tail_probability"
                      | "together"
                      | "variance"
                      | "variance_probability"
                      | "z_score";
                    order?: number;
                    parameters?: {
                      lambda?: string;
                      lower?: string;
                      mean?: string;
                      n?: string;
                      p?: string;
                      standard_deviation?: string;
                      upper?: string;
                    };
                    point?: string;
                    points?: Array<{ x: string; y: string }>;
                    right?: string;
                    right_matrix?: Array<Array<string>>;
                    upper?: string;
                    upperInclusive?: boolean;
                    values?: Array<string>;
                    variable?: string;
                    variables?: Array<string>;
                    vector?: Array<string>;
                  };
                  kind:
                    | "apart"
                    | "cancel"
                    | "circle"
                    | "combination"
                    | "compare"
                    | "cumulative_probability"
                    | "determinant"
                    | "differentiate"
                    | "distance"
                    | "distribution"
                    | "domain"
                    | "eigen_analysis"
                    | "eigenvalues"
                    | "eigenvectors"
                    | "evaluate"
                    | "expected_value"
                    | "expand"
                    | "factor"
                    | "gcd"
                    | "integrate"
                    | "intersection"
                    | "inverse"
                    | "interval_probability"
                    | "is_prime"
                    | "lcm"
                    | "limit"
                    | "line"
                    | "linear_system"
                    | "matrix_multiply"
                    | "mean"
                    | "median"
                    | "midpoint"
                    | "mode"
                    | "modular"
                    | "permutation"
                    | "point_probability"
                    | "prime_factorization"
                    | "product"
                    | "quartiles"
                    | "rank"
                    | "rationalize"
                    | "roots"
                    | "rref"
                    | "series"
                    | "simplify"
                    | "slope"
                    | "solve"
                    | "standard_deviation"
                    | "summation"
                    | "tail_probability"
                    | "together"
                    | "variance"
                    | "variance_probability"
                    | "z_score";
                  status: "loading";
                }
              | {
                  input: {
                    distribution?: string;
                    expression?: string;
                    expressions?: Array<string>;
                    inclusive?: boolean;
                    k?: string;
                    kind: "math";
                    left?: string;
                    lower?: string;
                    lowerInclusive?: boolean;
                    matrix?: Array<Array<string>>;
                    modulus?: string;
                    n?: string;
                    operation:
                      | "apart"
                      | "cancel"
                      | "circle"
                      | "combination"
                      | "compare"
                      | "cumulative_probability"
                      | "determinant"
                      | "differentiate"
                      | "distance"
                      | "distribution"
                      | "domain"
                      | "eigen_analysis"
                      | "eigenvalues"
                      | "eigenvectors"
                      | "evaluate"
                      | "expected_value"
                      | "expand"
                      | "factor"
                      | "gcd"
                      | "integrate"
                      | "intersection"
                      | "inverse"
                      | "interval_probability"
                      | "is_prime"
                      | "lcm"
                      | "limit"
                      | "line"
                      | "linear_system"
                      | "matrix_multiply"
                      | "mean"
                      | "median"
                      | "midpoint"
                      | "mode"
                      | "modular"
                      | "permutation"
                      | "point_probability"
                      | "prime_factorization"
                      | "product"
                      | "quartiles"
                      | "rank"
                      | "rationalize"
                      | "roots"
                      | "rref"
                      | "series"
                      | "simplify"
                      | "slope"
                      | "solve"
                      | "standard_deviation"
                      | "summation"
                      | "tail_probability"
                      | "together"
                      | "variance"
                      | "variance_probability"
                      | "z_score";
                    order?: number;
                    parameters?: {
                      lambda?: string;
                      lower?: string;
                      mean?: string;
                      n?: string;
                      p?: string;
                      standard_deviation?: string;
                      upper?: string;
                    };
                    point?: string;
                    points?: Array<{ x: string; y: string }>;
                    right?: string;
                    right_matrix?: Array<Array<string>>;
                    upper?: string;
                    upperInclusive?: boolean;
                    values?: Array<string>;
                    variable?: string;
                    variables?: Array<string>;
                    vector?: Array<string>;
                  };
                  kind:
                    | "apart"
                    | "cancel"
                    | "circle"
                    | "combination"
                    | "compare"
                    | "cumulative_probability"
                    | "determinant"
                    | "differentiate"
                    | "distance"
                    | "distribution"
                    | "domain"
                    | "eigen_analysis"
                    | "eigenvalues"
                    | "eigenvectors"
                    | "evaluate"
                    | "expected_value"
                    | "expand"
                    | "factor"
                    | "gcd"
                    | "integrate"
                    | "intersection"
                    | "inverse"
                    | "interval_probability"
                    | "is_prime"
                    | "lcm"
                    | "limit"
                    | "line"
                    | "linear_system"
                    | "matrix_multiply"
                    | "mean"
                    | "median"
                    | "midpoint"
                    | "mode"
                    | "modular"
                    | "permutation"
                    | "point_probability"
                    | "prime_factorization"
                    | "product"
                    | "quartiles"
                    | "rank"
                    | "rationalize"
                    | "roots"
                    | "rref"
                    | "series"
                    | "simplify"
                    | "slope"
                    | "solve"
                    | "standard_deviation"
                    | "summation"
                    | "tail_probability"
                    | "together"
                    | "variance"
                    | "variance_probability"
                    | "z_score";
                  result: {
                    conditions: Array<{ expression: string; latex: string }>;
                    input: {
                      distribution?: string;
                      expression?: string;
                      expressions?: Array<string>;
                      inclusive?: boolean;
                      k?: string;
                      kind: "math";
                      left?: string;
                      lower?: string;
                      lowerInclusive?: boolean;
                      matrix?: Array<Array<string>>;
                      modulus?: string;
                      n?: string;
                      operation:
                        | "apart"
                        | "cancel"
                        | "circle"
                        | "combination"
                        | "compare"
                        | "cumulative_probability"
                        | "determinant"
                        | "differentiate"
                        | "distance"
                        | "distribution"
                        | "domain"
                        | "eigen_analysis"
                        | "eigenvalues"
                        | "eigenvectors"
                        | "evaluate"
                        | "expected_value"
                        | "expand"
                        | "factor"
                        | "gcd"
                        | "integrate"
                        | "intersection"
                        | "inverse"
                        | "interval_probability"
                        | "is_prime"
                        | "lcm"
                        | "limit"
                        | "line"
                        | "linear_system"
                        | "matrix_multiply"
                        | "mean"
                        | "median"
                        | "midpoint"
                        | "mode"
                        | "modular"
                        | "permutation"
                        | "point_probability"
                        | "prime_factorization"
                        | "product"
                        | "quartiles"
                        | "rank"
                        | "rationalize"
                        | "roots"
                        | "rref"
                        | "series"
                        | "simplify"
                        | "slope"
                        | "solve"
                        | "standard_deviation"
                        | "summation"
                        | "tail_probability"
                        | "together"
                        | "variance"
                        | "variance_probability"
                        | "z_score";
                      order?: number;
                      parameters?: {
                        lambda?: string;
                        lower?: string;
                        mean?: string;
                        n?: string;
                        p?: string;
                        standard_deviation?: string;
                        upper?: string;
                      };
                      point?: string;
                      points?: Array<{ x: string; y: string }>;
                      right?: string;
                      right_matrix?: Array<Array<string>>;
                      upper?: string;
                      upperInclusive?: boolean;
                      values?: Array<string>;
                      variable?: string;
                      variables?: Array<string>;
                      vector?: Array<string>;
                    };
                    items: Array<{
                      label: string;
                      latex?: string;
                      value: string;
                    }>;
                    kind:
                      | "apart"
                      | "cancel"
                      | "circle"
                      | "combination"
                      | "compare"
                      | "cumulative_probability"
                      | "determinant"
                      | "differentiate"
                      | "distance"
                      | "distribution"
                      | "domain"
                      | "eigen_analysis"
                      | "eigenvalues"
                      | "eigenvectors"
                      | "evaluate"
                      | "expected_value"
                      | "expand"
                      | "factor"
                      | "gcd"
                      | "integrate"
                      | "intersection"
                      | "inverse"
                      | "interval_probability"
                      | "is_prime"
                      | "lcm"
                      | "limit"
                      | "line"
                      | "linear_system"
                      | "matrix_multiply"
                      | "mean"
                      | "median"
                      | "midpoint"
                      | "mode"
                      | "modular"
                      | "permutation"
                      | "point_probability"
                      | "prime_factorization"
                      | "product"
                      | "quartiles"
                      | "rank"
                      | "rationalize"
                      | "roots"
                      | "rref"
                      | "series"
                      | "simplify"
                      | "slope"
                      | "solve"
                      | "standard_deviation"
                      | "summation"
                      | "tail_probability"
                      | "together"
                      | "variance"
                      | "variance_probability"
                      | "z_score";
                    operation:
                      | "apart"
                      | "cancel"
                      | "circle"
                      | "combination"
                      | "compare"
                      | "cumulative_probability"
                      | "determinant"
                      | "differentiate"
                      | "distance"
                      | "distribution"
                      | "domain"
                      | "eigen_analysis"
                      | "eigenvalues"
                      | "eigenvectors"
                      | "evaluate"
                      | "expected_value"
                      | "expand"
                      | "factor"
                      | "gcd"
                      | "integrate"
                      | "intersection"
                      | "inverse"
                      | "interval_probability"
                      | "is_prime"
                      | "lcm"
                      | "limit"
                      | "line"
                      | "linear_system"
                      | "matrix_multiply"
                      | "mean"
                      | "median"
                      | "midpoint"
                      | "mode"
                      | "modular"
                      | "permutation"
                      | "point_probability"
                      | "prime_factorization"
                      | "product"
                      | "quartiles"
                      | "rank"
                      | "rationalize"
                      | "roots"
                      | "rref"
                      | "series"
                      | "simplify"
                      | "slope"
                      | "solve"
                      | "standard_deviation"
                      | "summation"
                      | "tail_probability"
                      | "together"
                      | "variance"
                      | "variance_probability"
                      | "z_score";
                    primary: { expression: string; latex: string };
                    reason: string;
                    secondary?: { expression: string; latex: string };
                    status: "verified" | "contradicted" | "inconclusive";
                    stepStatus: "complete" | "partial" | "unavailable";
                    steps: Array<{
                      action: string;
                      items: Array<{
                        label: string;
                        latex?: string;
                        value: string;
                      }>;
                      primary: { expression: string; latex: string };
                      relation?: { expression: string; latex: string };
                      secondary?: { expression: string; latex: string };
                    }>;
                  };
                  status: "verified" | "contradicted" | "inconclusive";
                  summary: string;
                }
              | {
                  error: string;
                  input: {
                    distribution?: string;
                    expression?: string;
                    expressions?: Array<string>;
                    inclusive?: boolean;
                    k?: string;
                    kind: "math";
                    left?: string;
                    lower?: string;
                    lowerInclusive?: boolean;
                    matrix?: Array<Array<string>>;
                    modulus?: string;
                    n?: string;
                    operation:
                      | "apart"
                      | "cancel"
                      | "circle"
                      | "combination"
                      | "compare"
                      | "cumulative_probability"
                      | "determinant"
                      | "differentiate"
                      | "distance"
                      | "distribution"
                      | "domain"
                      | "eigen_analysis"
                      | "eigenvalues"
                      | "eigenvectors"
                      | "evaluate"
                      | "expected_value"
                      | "expand"
                      | "factor"
                      | "gcd"
                      | "integrate"
                      | "intersection"
                      | "inverse"
                      | "interval_probability"
                      | "is_prime"
                      | "lcm"
                      | "limit"
                      | "line"
                      | "linear_system"
                      | "matrix_multiply"
                      | "mean"
                      | "median"
                      | "midpoint"
                      | "mode"
                      | "modular"
                      | "permutation"
                      | "point_probability"
                      | "prime_factorization"
                      | "product"
                      | "quartiles"
                      | "rank"
                      | "rationalize"
                      | "roots"
                      | "rref"
                      | "series"
                      | "simplify"
                      | "slope"
                      | "solve"
                      | "standard_deviation"
                      | "summation"
                      | "tail_probability"
                      | "together"
                      | "variance"
                      | "variance_probability"
                      | "z_score";
                    order?: number;
                    parameters?: {
                      lambda?: string;
                      lower?: string;
                      mean?: string;
                      n?: string;
                      p?: string;
                      standard_deviation?: string;
                      upper?: string;
                    };
                    point?: string;
                    points?: Array<{ x: string; y: string }>;
                    right?: string;
                    right_matrix?: Array<Array<string>>;
                    upper?: string;
                    upperInclusive?: boolean;
                    values?: Array<string>;
                    variable?: string;
                    variables?: Array<string>;
                    vector?: Array<string>;
                  };
                  kind:
                    | "apart"
                    | "cancel"
                    | "circle"
                    | "combination"
                    | "compare"
                    | "cumulative_probability"
                    | "determinant"
                    | "differentiate"
                    | "distance"
                    | "distribution"
                    | "domain"
                    | "eigen_analysis"
                    | "eigenvalues"
                    | "eigenvectors"
                    | "evaluate"
                    | "expected_value"
                    | "expand"
                    | "factor"
                    | "gcd"
                    | "integrate"
                    | "intersection"
                    | "inverse"
                    | "interval_probability"
                    | "is_prime"
                    | "lcm"
                    | "limit"
                    | "line"
                    | "linear_system"
                    | "matrix_multiply"
                    | "mean"
                    | "median"
                    | "midpoint"
                    | "mode"
                    | "modular"
                    | "permutation"
                    | "point_probability"
                    | "prime_factorization"
                    | "product"
                    | "quartiles"
                    | "rank"
                    | "rationalize"
                    | "roots"
                    | "rref"
                    | "series"
                    | "simplify"
                    | "slope"
                    | "solve"
                    | "standard_deviation"
                    | "summation"
                    | "tail_probability"
                    | "together"
                    | "variance"
                    | "variance_probability"
                    | "z_score";
                  status: "error";
                };
            dataMathId?: string;
            dataNakafaData?:
              | {
                  input: {
                    limit: number;
                    locale: "en" | "id" | "de";
                    offset: number;
                    queries?: Array<string>;
                    section?: "articles" | "material" | "tryout" | "quran";
                  };
                  kind: "search";
                  status: "loading";
                }
              | {
                  input: {
                    limit: number;
                    locale: "en" | "id" | "de";
                    offset: number;
                    queries?: Array<string>;
                    section?: "articles" | "material" | "tryout" | "quran";
                  };
                  kind: "search";
                  result: {
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
                  };
                  status: "done";
                }
              | {
                  error: string;
                  input: {
                    limit: number;
                    locale: "en" | "id" | "de";
                    offset: number;
                    queries?: Array<string>;
                    section?: "articles" | "material" | "tryout" | "quran";
                  };
                  kind: "search";
                  status: "error";
                }
              | {
                  input: { content_ref: string };
                  kind: "content";
                  status: "loading";
                }
              | {
                  input: { content_ref: string };
                  kind: "content";
                  result: {
                    alignmentId: string;
                    assetId: string;
                    conceptId: string;
                    content_id: string;
                    description?: string;
                    learningObjectId: string;
                    lensId: string;
                    locale: "en" | "id" | "de";
                    markdown_url?: string;
                    route: string;
                    section: "articles" | "material" | "tryout" | "quran";
                    title: string;
                    url: string;
                  };
                  status: "done";
                }
              | {
                  error: string;
                  input: { content_ref: string };
                  kind: "content";
                  status: "error";
                }
              | {
                  input: {
                    from_verse: number;
                    include_tafsir: boolean;
                    locale: "en" | "id" | "de";
                    surah: number;
                    to_verse?: number;
                  };
                  kind: "quran";
                  status: "loading";
                }
              | {
                  input: {
                    from_verse: number;
                    include_tafsir: boolean;
                    locale: "en";
                    surah: number;
                    to_verse?: number;
                  };
                  kind: "quran";
                  result: {
                    alignmentId: string;
                    assetId: string;
                    conceptId: string;
                    content_id: string;
                    from_verse: number;
                    learningObjectId: string;
                    lensId: string;
                    locale: "en";
                    markdown_url?: string;
                    meaning: { locale: "en" | "en"; text: string };
                    name: string;
                    revelation: string;
                    route: string;
                    section: "articles" | "material" | "tryout" | "quran";
                    to_verse: number;
                    url: string;
                    verse_count: number;
                  };
                  status: "done";
                }
              | {
                  input: {
                    from_verse: number;
                    include_tafsir: boolean;
                    locale: "id";
                    surah: number;
                    to_verse?: number;
                  };
                  kind: "quran";
                  result: {
                    alignmentId: string;
                    assetId: string;
                    conceptId: string;
                    content_id: string;
                    from_verse: number;
                    learningObjectId: string;
                    lensId: string;
                    locale: "id";
                    markdown_url?: string;
                    meaning: { locale: "id" | "en"; text: string };
                    name: string;
                    revelation: string;
                    route: string;
                    section: "articles" | "material" | "tryout" | "quran";
                    to_verse: number;
                    url: string;
                    verse_count: number;
                  };
                  status: "done";
                }
              | {
                  input: {
                    from_verse: number;
                    include_tafsir: boolean;
                    locale: "de";
                    surah: number;
                    to_verse?: number;
                  };
                  kind: "quran";
                  result: {
                    alignmentId: string;
                    assetId: string;
                    conceptId: string;
                    content_id: string;
                    from_verse: number;
                    learningObjectId: string;
                    lensId: string;
                    locale: "de";
                    markdown_url?: string;
                    meaning: { locale: "de" | "en"; text: string };
                    name: string;
                    revelation: string;
                    route: string;
                    section: "articles" | "material" | "tryout" | "quran";
                    to_verse: number;
                    url: string;
                    verse_count: number;
                  };
                  status: "done";
                }
              | {
                  input: {
                    from_verse: number;
                    include_tafsir: boolean;
                    locale: "en" | "id" | "de";
                    surah: number;
                    to_verse?: number;
                  };
                  kind: "quran";
                  result: {
                    alignmentId: string;
                    assetId: string;
                    conceptId: string;
                    content_id: string;
                    from_verse: number;
                    learningObjectId: string;
                    lensId: string;
                    locale: "en" | "id" | "de";
                    markdown_url?: string;
                    name: string;
                    revelation: string;
                    route: string;
                    section: "articles" | "material" | "tryout" | "quran";
                    to_verse: number;
                    translation: string;
                    url: string;
                    verse_count: number;
                  };
                  status: "done";
                }
              | {
                  error: string;
                  input: {
                    from_verse: number;
                    include_tafsir: boolean;
                    locale: "en" | "id" | "de";
                    surah: number;
                    to_verse?: number;
                  };
                  kind: "quran";
                  status: "error";
                }
              | {
                  input: { locale: "en" | "id" | "de" };
                  kind: "taxonomy";
                  status: "loading";
                }
              | {
                  input: { locale: "en" | "id" | "de" };
                  kind: "taxonomy";
                  result: {
                    content_counts: Array<{
                      count: number;
                      locale: "en" | "id" | "de";
                    }>;
                    locale: "en" | "id" | "de";
                    sections: Array<
                      "articles" | "material" | "tryout" | "quran"
                    >;
                    tools: Array<string>;
                  };
                  status: "done";
                }
              | {
                  error: string;
                  input: { locale: "en" | "id" | "de" };
                  kind: "taxonomy";
                  status: "error";
                };
            dataNakafaId?: string;
            dataScrapeUrlContent?: string;
            dataScrapeUrlDescription?: string;
            dataScrapeUrlError?: string;
            dataScrapeUrlFavicon?: string;
            dataScrapeUrlId?: string;
            dataScrapeUrlStatus?: "loading" | "done" | "error";
            dataScrapeUrlTitle?: string;
            dataScrapeUrlUrl?: string;
            dataSuggestionsData?: Array<string>;
            dataSuggestionsId?: string;
            dataWebSearchError?: string;
            dataWebSearchId?: string;
            dataWebSearchProvider?: "firecrawl" | "google";
            dataWebSearchQueries?: Array<string>;
            dataWebSearchSources?: Array<{
              citation: string;
              content: string;
              description: string;
              title: string;
              url: string;
            }>;
            dataWebSearchStatus?: "loading" | "done" | "error";
            fileFilename?: string;
            fileMediaType?: string;
            fileUrl?: string;
            messageId?: Id<"messages">;
            order: number;
            providerMetadata?: Record<string, Record<string, string>>;
            reasoningState?: "streaming" | "done";
            reasoningText?: string;
            textState?: "streaming" | "done";
            textText?: string;
            toolCallProviderMetadata?: Record<string, Record<string, string>>;
            toolDeepResearchInput?: {
              objective: string;
              request: string;
              requirements?: Array<string>;
              sourceRequirements: Array<string>;
            };
            toolDeepResearchOutput?: string;
            toolErrorText?: string;
            toolMathInput?: {
              given: Array<string>;
              objective: string;
              request: string;
              requirements?: Array<string>;
            };
            toolMathOutput?: string;
            toolNakafaInput?: {
              deliverables: Array<string>;
              objective: string;
              request: string;
              requirements?: Array<string>;
            };
            toolNakafaOutput?: string;
            toolResultProviderMetadata?: Record<string, Record<string, string>>;
            toolState?:
              | "input-streaming"
              | "input-available"
              | "output-available"
              | "output-error";
            toolToolCallId?: string;
            type:
              | "text"
              | "reasoning"
              | "file"
              | "step-start"
              | "tool-nakafa"
              | "tool-deepResearch"
              | "tool-math"
              | "data-suggestions"
              | "data-nakafa"
              | "data-math"
              | "data-scrape-url"
              | "data-web-search";
          }>;
          userId: Id<"users">;
        },
        null | {
          credits: number;
          messageId: Id<"messages">;
          newBalance: number;
          partIds: Array<Id<"messageParts">>;
        }
      >;
    };
    traces: {
      mutations: {
        deleteExpiredBatch: FunctionReference<
          "mutation",
          "internal",
          { now: number },
          { deleted: number; hasMore: boolean }
        >;
        sweepExpired: FunctionReference<
          "mutation",
          "internal",
          {},
          { deleted: number; hasMore: boolean }
        >;
      };
    };
  };
  classes: {
    forums: {
      attachments: {
        upload: {
          claim: FunctionReference<
            "mutation",
            "internal",
            { leaseId: string; uploadId: string; uploadToken: string },
            boolean
          >;
          release: FunctionReference<
            "mutation",
            "internal",
            { leaseId: string; uploadId: string },
            null
          >;
          settle: FunctionReference<
            "mutation",
            "internal",
            {
              contentType: string;
              leaseId: string;
              size: number;
              storageId: Id<"_storage">;
              uploadId: string;
              uploadToken: string;
            },
            "accepted" | "discarded" | "rejected"
          >;
        };
      };
      internalMutations: {
        deleteExpiredPendingUpload: FunctionReference<
          "mutation",
          "internal",
          { uploadId: Id<"schoolClassForumPendingUploads"> },
          null
        >;
      };
    };
    materials: {
      mutations: {
        publishMaterialGroup: FunctionReference<
          "mutation",
          "internal",
          {
            groupId: Id<"schoolClassMaterialGroups">;
            publishedBy: Id<"users">;
          },
          null
        >;
      };
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
            | "artifacts"
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
            | "artifacts"
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
      protected: {
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
      public: {
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
            scopeMode: "global" | "placement";
            windowKey: "1d" | "7d" | "14d" | "30d" | "90d" | "180d" | "365d";
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
        refreshLearningPopularityWindowPage: FunctionReference<
          "mutation",
          "internal",
          {
            cursor?: string;
            day: number;
            scopeMode: "global" | "placement";
            windowKey: "1d" | "7d" | "14d" | "30d" | "90d" | "180d" | "365d";
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
        sweepLearningPopularityRetention: FunctionReference<
          "mutation",
          "internal",
          { day: number },
          { deleted: number; done: boolean; skipped: boolean }
        >;
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
  customers: {
    actions: {
      internal: {
        cleanupDeletedUserCustomerData: FunctionReference<
          "action",
          "internal",
          { authId: string; userId: Id<"users"> },
          null
        >;
        syncCustomer: FunctionReference<
          "action",
          "internal",
          { userId: Id<"users"> },
          Id<"customers"> | null
        >;
      };
    };
    checkout: {
      admission: {
        admitCheckoutSession: FunctionReference<
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
                    access_source:
                      "free" | "competition" | "access-pass" | "subscription";
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
                  properties: { source: "access-query" | "start-mutation" };
                }
              | {
                  name: "chat message sent";
                  properties: {
                    chat_type: "study";
                    model_id?: "nakafa-lite" | "nakafa-pro";
                  };
                }
              | {
                  name: "chat response completed";
                  properties: {
                    chat_type: "study";
                    credits?: number;
                    input_tokens?: number;
                    model_id?: "nakafa-lite" | "nakafa-pro";
                    output_tokens?: number;
                    total_tokens?: number;
                  };
                }
              | {
                  name: "chat response failed";
                  properties: {
                    chat_type: "study";
                    error_code: "CHAT_RESPONSE_FAILED";
                    model_id?: "nakafa-lite" | "nakafa-pro";
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
      };
    };
    deletion: {
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
        cleanupDeletedUserCustomer: FunctionReference<
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
    integrity: {
      internal: {
        listActiveSubscriptionsForIntegrity: FunctionReference<
          "query",
          "internal",
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
              currentPeriodEnd: string | null;
              customerId: string;
              status: string;
              subscriptionId: string;
            }>;
          }
        >;
        listCustomersForIntegrity: FunctionReference<
          "query",
          "internal",
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
              externalId: string | null;
              localCustomerId: Id<"customers">;
              polarCustomerId: string;
              userId: Id<"users">;
            }>;
          }
        >;
        listUsersForCustomerIntegrity: FunctionReference<
          "query",
          "internal",
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
            page: Array<{ authId: string; email: string; userId: Id<"users"> }>;
          }
        >;
      };
    };
    mutations: {
      internal: {
        completeCustomerDeletionCheckpoint: FunctionReference<
          "mutation",
          "internal",
          { polarCustomerId: string; userId: Id<"users"> },
          null
        >;
        deleteCustomerById: FunctionReference<
          "mutation",
          "internal",
          { id: string },
          boolean
        >;
        recordCustomerDeletionCheckpoint: FunctionReference<
          "mutation",
          "internal",
          { polarCustomerId: string; userId: Id<"users"> },
          null
        >;
        upsertCustomer: FunctionReference<
          "mutation",
          "internal",
          {
            customer: {
              externalId: null | string;
              id: string;
              metadata?: Record<string, string | number | boolean>;
              userId: Id<"users">;
            };
          },
          | { customerId: Id<"customers">; kind: "stored" }
          | { kind: "deleted" }
          | { kind: "missing" }
          | { kind: "prepared" }
        >;
      };
    };
    queries: {
      internal: {
        customer: {
          getCustomerByPolarId: FunctionReference<
            "query",
            "internal",
            { polarCustomerId: string },
            null | {
              _creationTime: number;
              _id: Id<"customers">;
              externalId: null | string;
              id: string;
              metadata?: Record<string, string | number | boolean>;
              userId: Id<"users">;
            }
          >;
          getCustomerByUserId: FunctionReference<
            "query",
            "internal",
            { userId: Id<"users"> },
            null | {
              _creationTime: number;
              _id: Id<"customers">;
              externalId: null | string;
              id: string;
              metadata?: Record<string, string | number | boolean>;
              userId: Id<"users">;
            }
          >;
          getCustomerDeletionCheckpoint: FunctionReference<
            "query",
            "internal",
            { userId: Id<"users"> },
            null | string
          >;
          hasActiveSubscriptionByCustomerId: FunctionReference<
            "query",
            "internal",
            { customerId: string },
            boolean
          >;
          resolveWebhookTarget: FunctionReference<
            "query",
            "internal",
            {
              externalId?: string;
              metadataUserId?: string;
              polarCustomerId: string;
            },
            | { kind: "active"; userId: Id<"users"> }
            | { kind: "conflict" }
            | { kind: "deleted" }
            | { kind: "missing" }
            | { kind: "prepared" }
          >;
        };
      };
    };
  };
  emails: {
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
  onboarding: {
    lifecycle: {
      readLifecyclePage: FunctionReference<
        "query",
        "internal",
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
            dataQuality: {
              completedWithoutAdmission: number;
              completedWithoutRole: number;
              completedWithoutStart: number;
              startedWithoutAdmission: number;
            };
            incomplete: {
              admittedNotStarted: number;
              noRecordedAdmission: number;
              startedNotCompleted: number;
            };
            milestones: {
              admitted: number;
              completed: number;
              started: number;
            };
            population: { eligible: number; excluded: number; scanned: number };
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
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
  subscriptions: {
    mutations: {
      createSubscription: FunctionReference<
        "mutation",
        "internal",
        {
          subscription: {
            amount: null | number;
            cancelAtPeriodEnd: boolean;
            checkoutId: null | string;
            createdAt: string;
            currency: null | string;
            currentPeriodEnd: null | string;
            currentPeriodStart: string;
            customerCancellationComment?: null | string;
            customerCancellationReason?: null | string;
            customerId: string;
            endedAt: null | string;
            id: string;
            metadata: Record<string, string | number | boolean>;
            modifiedAt: null | string;
            priceId?: string;
            productId: string;
            recurringInterval: null | "day" | "week" | "month" | "year";
            schoolId?: string;
            startedAt: null | string;
            status: string;
          };
        },
        Id<"subscriptions"> | null
      >;
      updateSubscription: FunctionReference<
        "mutation",
        "internal",
        {
          subscription: {
            amount: null | number;
            cancelAtPeriodEnd: boolean;
            checkoutId: null | string;
            createdAt: string;
            currency: null | string;
            currentPeriodEnd: null | string;
            currentPeriodStart: string;
            customerCancellationComment?: null | string;
            customerCancellationReason?: null | string;
            customerId: string;
            endedAt: null | string;
            id: string;
            metadata: Record<string, string | number | boolean>;
            modifiedAt: null | string;
            priceId?: string;
            productId: string;
            recurringInterval: null | "day" | "week" | "month" | "year";
            schoolId?: string;
            startedAt: null | string;
            status: string;
          };
        },
        null
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
    materials: {
      cleanup: {
        cleanupDeletedGroup: FunctionReference<
          "mutation",
          "internal",
          {
            classId: Id<"schoolClasses">;
            groupId: Id<"schoolClassMaterialGroups">;
          },
          null
        >;
        cleanupDeletedMaterial: FunctionReference<
          "mutation",
          "internal",
          { materialId: Id<"schoolClassMaterials"> },
          null
        >;
      };
    };
    schools: {
      cleanup: {
        cleanupDeletedClass: FunctionReference<
          "mutation",
          "internal",
          { classId: Id<"schoolClasses"> },
          null
        >;
        cleanupDeletedForum: FunctionReference<
          "mutation",
          "internal",
          { forumId: Id<"schoolClassForums"> },
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
        null | {
          _creationTime: number;
          _id: Id<"users">;
          authId: string;
          authVerificationCleanupCursor?: string;
          credits: number;
          creditsResetAt: number;
          deletedAt?: number;
          deletionCleanupStartedAt?: number;
          deletionPreparedAt?: number;
          email: string;
          image?: string;
          name: string;
          plan: "free" | "pro";
          role?: "teacher" | "student" | "parent" | "administrator";
        }
      >;
      getUserById: FunctionReference<
        "query",
        "internal",
        { userId: Id<"users"> },
        null | {
          _creationTime: number;
          _id: Id<"users">;
          authId: string;
          authVerificationCleanupCursor?: string;
          credits: number;
          creditsResetAt: number;
          deletedAt?: number;
          deletionCleanupStartedAt?: number;
          deletionPreparedAt?: number;
          email: string;
          image?: string;
          name: string;
          plan: "free" | "pro";
          role?: "teacher" | "student" | "parent" | "administrator";
        }
      >;
    };
  };
};

export declare const components: {
  betterAuth: import("@repo/backend/convex/betterAuth/_generated/component.js").ComponentApi<"betterAuth">;
  agentRateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"agentRateLimiter">;
  workflow: import("@convex-dev/workflow/_generated/component.js").ComponentApi<"workflow">;
  resend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
  posthog: import("@posthog/convex/_generated/component.js").ComponentApi<"posthog">;
  globalLeaderboard: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"globalLeaderboard">;
  forumPostsBySequence: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"forumPostsBySequence">;
  forumPostsByAuthorSequence: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"forumPostsByAuthorSequence">;
  learningPopularityRankings: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"learningPopularityRankings">;
};
