/**
 * Domain validation utilities for API security
 */

export type DomainValidatorConfig = {
  /** Primary domain to allow (e.g., "nakafa.com") */
  allowedDomain?: string;
  /** Additional allowed origins (e.g., localhost for development) */
  additionalOrigins?: string[];
  /** Whether to allow www subdomain */
  allowWww?: boolean;
};

export class DomainValidator {
  private readonly allowedDomain: string;
  private readonly additionalOrigins: string[];
  private readonly allowWww: boolean;

  constructor(config: DomainValidatorConfig = {}) {
    this.allowedDomain =
      config.allowedDomain || process.env.ALLOWED_DOMAIN || "nakafa.com";
    this.additionalOrigins =
      config.additionalOrigins || this.getDefaultDevelopmentOrigins();
    this.allowWww = config.allowWww ?? true;
  }

  private getDefaultDevelopmentOrigins(): string[] {
    // Only include localhost in development
    if (process.env.NODE_ENV === "development") {
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

    if (this.allowWww) {
      origins.push(`https://www.${this.allowedDomain}`);
    }

    return origins;
  }

  /**
   * Check if the request origin is from an allowed domain
   */
  isRequestFromAllowedDomain(request: Request): boolean {
    const allowedOrigins = this.getAllowedOrigins();

    // Check Origin header (for CORS requests)
    const origin = request.headers.get("origin");
    if (origin && allowedOrigins.includes(origin)) {
      return true;
    }

    // Check Referer header (for same-origin requests)
    const referer = request.headers.get("referer");
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        const refererOrigin = `${refererUrl.protocol}//${refererUrl.host}`;
        return allowedOrigins.includes(refererOrigin);
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
    return allowedOrigins.includes(origin);
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
  createForbiddenResponse(message = "Access denied"): Response {
    return new Response(JSON.stringify({ error: message }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
}
