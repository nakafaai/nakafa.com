import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();

// CORS handling is required for client side frameworks
authComponent.registerRoutes(http, createAuth, { cors: true });

export default http;
