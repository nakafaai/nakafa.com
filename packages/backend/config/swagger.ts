export const swaggerConfig = {
  documentation: {
    info: {
      title: "Nakafa API",
      version: "1.0.0",
      description:
        "Nakafa educational content API with comprehensive multilingual support.",
    },
    servers: [
      { url: "http://localhost:3002", description: "Development server." },
      { url: "https://api.nakafa.com", description: "Production server." },
    ],
    tags: [
      { name: "Health", description: "Health check endpoints." },
      { name: "Contents", description: "Educational content endpoints." },
    ],
  },
  path: "/docs",
};
