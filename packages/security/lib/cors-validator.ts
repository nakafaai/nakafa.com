/**
 * CORS validation utilities for API security
 */

export type CorsValidatorConfig = {
  /** Primary domain to allow (e.g., "nakafa.com") */
  allowedDomain?: string;
  /** Additional allowed origins (e.g., localhost for development) */
  additionalOrigins?: string[];
  /** Whether to allow all subdomains */
  allowSubdomains?: boolean;
};

export class CorsValidator {
  private readonly allowedDomain: string;
  private readonly additionalOrigins: string[];
  private readonly allowSubdomains: boolean;

  constructor({
    allowedDomain = "nakafa.com",
    additionalOrigins = [],
    allowSubdomains = true,
  }: CorsValidatorConfig = {}) {
    this.allowedDomain = allowedDomain;
    this.additionalOrigins = [
      ...this.getDefaultDevelopmentOrigins(),
      ...additionalOrigins,
    ];
    this.allowSubdomains = allowSubdomains;
  }

  private getDefaultDevelopmentOrigins(): string[] {
    // Only include localhost in development
    if (
      process.env.NODE_ENV === "development" ||
      process.env.VERCEL_TARGET_ENV === "development"
    ) {
      return [
        "http://localhost:3000", // www app
        "http://localhost:3001", // mcp app
        "http://localhost:3002", // api app
      ];
    }
    return [];
  }

  private getAllowedOrigins(): string[] {
    const origins = [
      `https://${this.allowedDomain}`,
      ...this.additionalOrigins,
    ];

    // Note: For subdomain validation, we check dynamically in validation methods
    // rather than pre-generating all possible subdomains
    return origins;
  }

  /**
   * Check if a hostname is allowed (supports subdomains)
   */
  private isHostnameAllowed(hostname: string): boolean {
    // Exact match
    if (hostname === this.allowedDomain) {
      return true;
    }

    // Subdomain check (e.g., api.nakafa.com, www.nakafa.com)
    if (this.allowSubdomains && hostname.endsWith(`.${this.allowedDomain}`)) {
      return true;
    }

    return false;
  }

  /**
   * Check if the request origin is from an allowed domain
   */
  isRequestFromAllowedDomain(request: Request): boolean {
    const allowedOrigins = this.getAllowedOrigins();

    // Check Origin header (for CORS requests)
    const origin = request.headers.get("origin");
    if (origin) {
      // First check exact matches from allowedOrigins
      if (allowedOrigins.includes(origin)) {
        return true;
      }

      // Then check subdomain matches
      try {
        const originUrl = new URL(origin);
        if (
          originUrl.protocol === "https:" &&
          this.isHostnameAllowed(originUrl.hostname)
        ) {
          return true;
        }
      } catch {
        return false;
      }
    }

    // Check Referer header (for same-origin requests)
    const referer = request.headers.get("referer");
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        if (
          refererUrl.protocol === "https:" &&
          this.isHostnameAllowed(refererUrl.hostname)
        ) {
          return true;
        }
      } catch {
        return false;
      }
    }

    // If neither header is present or valid, deny access
    return false;
  }

  /**
   * Check if origin is allowed (for middleware CORS handling)
   */
  isOriginAllowed(origin: string): boolean {
    const allowedOrigins = this.getAllowedOrigins();

    // First check exact matches
    if (allowedOrigins.includes(origin)) {
      return true;
    }

    // Then check subdomain matches
    try {
      const originUrl = new URL(origin);
      if (
        originUrl.protocol === "https:" &&
        this.isHostnameAllowed(originUrl.hostname)
      ) {
        return true;
      }
    } catch {
      return false;
    }

    return false;
  }

  /**
   * Get CORS headers for allowed origin
   */
  getCorsHeaders(origin?: string): Record<string, string> {
    const headers: Record<string, string> = {
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400", // 24 hours
    };

    if (origin && this.isOriginAllowed(origin)) {
      headers["Access-Control-Allow-Origin"] = origin;
    }

    return headers;
  }

  /**
   * Create a 403 Forbidden response
   */
  createForbiddenResponse(message = "Access denied."): Response {
    return new Response(message, {
      status: 403,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
