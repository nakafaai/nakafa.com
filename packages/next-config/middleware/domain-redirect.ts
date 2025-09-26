import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getRedirectUrl, isSeoDomain, MAIN_DOMAIN } from "../domains";

// Define regex patterns at top level for performance
// Comprehensive regex for major search engine bots
const SEARCH_ENGINE_BOT_REGEX =
  /(googlebot|bingbot|baiduspider|yandexbot|duckduckbot|slurp|teoma|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|applebot|ia_archiver|petalbot|sogou|360spider|bot|crawler|spider|crawling)/i;

/**
 * Domain-based redirect middleware for SEO domains
 * Allows domains to be indexed by Google but redirects users to nakafa.com
 */
export function domainRedirectMiddleware(request: NextRequest) {
  const hostname = request.nextUrl.hostname;
  const pathname = request.nextUrl.pathname;
  const searchParams = request.nextUrl.searchParams;

  // Skip if already on main domain - let internationalization handle it
  if (hostname === MAIN_DOMAIN || hostname === `www.${MAIN_DOMAIN}`) {
    return null;
  }

  // Check if this is one of our SEO domains
  if (!isSeoDomain(hostname)) {
    return null;
  }

  // Handle sitemap requests - always serve, never redirect
  if (pathname === "/sitemap.xml") {
    const url = request.nextUrl.clone();
    url.hostname = MAIN_DOMAIN;
    url.pathname = "/sitemap-domain.xml";
    return NextResponse.rewrite(url);
  }

  // Handle different types of requests
  const userAgent = request.headers.get("user-agent") || "";
  const isSearchEngineBot = SEARCH_ENGINE_BOT_REGEX.test(userAgent);

  // For search engine bots, serve the landing page instead of redirecting
  if (isSearchEngineBot) {
    return serveLandingPage(request);
  }

  // For regular users, redirect to nakafa.com
  const redirectUrl = getRedirectUrl(pathname);
  const finalUrl = searchParams.toString()
    ? `${redirectUrl}?${searchParams.toString()}`
    : redirectUrl;

  const TEMPORARY_REDIRECT = 307;
  return NextResponse.redirect(finalUrl, TEMPORARY_REDIRECT);
}

/**
 * Serve a landing page for bots to ensure proper indexing
 */
function serveLandingPage(request: NextRequest) {
  const hostname = request.nextUrl.hostname;
  const pathname = request.nextUrl.pathname;

  // Rewrite to a special landing page route
  const url = request.nextUrl.clone();
  url.hostname = MAIN_DOMAIN;
  url.pathname = `/d/${hostname}${pathname}`;

  return NextResponse.rewrite(url);
}
