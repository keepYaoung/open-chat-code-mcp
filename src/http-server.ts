import { randomUUID } from "node:crypto";
import type { Server as HttpServer } from "node:http";

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import express, { type Request, type Response } from "express";

import { createBearerAuth, createHostValidation } from "./auth.js";
import type { AppConfig } from "./config.js";
import { errorMessage } from "./errors.js";
import { createMcpServer, type McpServices } from "./mcp-server.js";
import { OAUTH_SCOPES, RemoteDevOAuthProvider } from "./oauth.js";

interface ActiveSession {
  transport: StreamableHTTPServerTransport;
  server: ReturnType<typeof createMcpServer>;
  lastUsedAt: number;
}

export interface RunningHttpServer {
  httpServer: HttpServer;
  close: () => Promise<void>;
}

function rpcError(response: Response, status: number, message: string): void {
  response.status(status).json({
    jsonrpc: "2.0",
    error: { code: -32000, message },
    id: null,
  });
}

export async function startHttpServer(
  config: AppConfig,
  services: McpServices,
): Promise<RunningHttpServer> {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(express.json({ limit: config.maxRequestBody }));
  app.use(createHostValidation(config));

  const sessions = new Map<string, ActiveSession>();
  const oauthProvider = config.oauthEnabled ? new RemoteDevOAuthProvider(config) : undefined;
  if (oauthProvider) {
    app.get("/.well-known/oauth-protected-resource", (_request, response) => {
      response.json({
        resource: oauthProvider.resourceUrl.href,
        authorization_servers: [oauthProvider.issuerUrl.href],
        scopes_supported: [...OAUTH_SCOPES],
        bearer_methods_supported: ["header"],
        resource_name: "cokacremote",
      });
    });
    app.use(
      mcpAuthRouter({
        provider: oauthProvider,
        issuerUrl: oauthProvider.issuerUrl,
        resourceServerUrl: oauthProvider.resourceUrl,
        scopesSupported: [...OAUTH_SCOPES],
        resourceName: "cokacremote",
        clientRegistrationOptions: { clientSecretExpirySeconds: 0 },
      }),
    );
  }
  const authenticate = createBearerAuth(config, oauthProvider);

  app.get("/health", (_request, response) => {
    response.json({
      status: "ok",
      service: "cokacremote",
      version: "0.1.0",
      activeMcpSessions: sessions.size,
      managedProcesses: services.processManager.list().length,
      unrestrictedHostAccess: true,
      oauthEnabled: config.oauthEnabled,
    });
  });

  const postHandler = async (request: Request, response: Response): Promise<void> => {
    const sessionId = request.header("mcp-session-id");
    try {
      if (sessionId) {
        const session = sessions.get(sessionId);
        if (!session) {
          rpcError(response, 404, "Unknown or expired MCP session");
          return;
        }
        session.lastUsedAt = Date.now();
        await session.transport.handleRequest(request, response, request.body);
        return;
      }

      if (!isInitializeRequest(request.body)) {
        rpcError(response, 400, "An initialize request or valid MCP session ID is required");
        return;
      }

      let activeSession: ActiveSession;
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (initializedSessionId) => {
          activeSession.lastUsedAt = Date.now();
          sessions.set(initializedSessionId, activeSession);
        },
      });
      const server = createMcpServer(config, services);
      activeSession = { transport, server, lastUsedAt: Date.now() };
      transport.onclose = () => {
        const closedSessionId = transport.sessionId;
        if (closedSessionId) {
          sessions.delete(closedSessionId);
        }
      };
      transport.onerror = (error) => {
        console.error("MCP transport error:", errorMessage(error));
      };
      await server.connect(transport);
      await transport.handleRequest(request, response, request.body);
    } catch (error) {
      console.error("MCP POST failed:", errorMessage(error));
      if (!response.headersSent) {
        rpcError(response, 500, "Internal MCP server error");
      }
    }
  };

  const sessionHandler = async (request: Request, response: Response): Promise<void> => {
    const sessionId = request.header("mcp-session-id");
    if (!sessionId) {
      rpcError(response, 400, "MCP-Session-Id header is required");
      return;
    }
    const session = sessions.get(sessionId);
    if (!session) {
      rpcError(response, 404, "Unknown or expired MCP session");
      return;
    }
    session.lastUsedAt = Date.now();
    try {
      await session.transport.handleRequest(request, response);
    } catch (error) {
      console.error(`MCP ${request.method} failed:`, errorMessage(error));
      if (!response.headersSent) {
        rpcError(response, 500, "Internal MCP server error");
      }
    }
  };

  app.post(config.endpoint, authenticate, (request, response) => {
    void postHandler(request, response);
  });
  app.get(config.endpoint, authenticate, (request, response) => {
    void sessionHandler(request, response);
  });
  app.delete(config.endpoint, authenticate, (request, response) => {
    void sessionHandler(request, response);
  });

  app.use(
    (
      error: unknown,
      _request: Request,
      response: Response,
      _next: express.NextFunction,
    ) => {
      if (!response.headersSent) {
        rpcError(response, 400, `Invalid request body: ${errorMessage(error)}`);
      }
    },
  );

  const cleanupInterval = setInterval(() => {
    const cutoff = Date.now() - config.sessionTtlMs;
    for (const [sessionId, session] of sessions) {
      if (session.lastUsedAt < cutoff) {
        sessions.delete(sessionId);
        void session.server.close().catch((error) => {
          console.error(`Failed to close expired session ${sessionId}:`, errorMessage(error));
        });
      }
    }
    services.processManager.prune();
  }, Math.min(config.sessionTtlMs, 60_000));
  cleanupInterval.unref();

  const httpServer = await new Promise<HttpServer>((resolve, reject) => {
    const listeningServer = app.listen(config.port, config.host, () => resolve(listeningServer));
    listeningServer.once("error", reject);
  });

  const close = async (): Promise<void> => {
    clearInterval(cleanupInterval);
    const activeSessions = [...sessions.values()];
    sessions.clear();
    await Promise.allSettled(activeSessions.map((session) => session.server.close()));
    await services.processManager.shutdown();
    await new Promise<void>((resolve, reject) => {
      httpServer.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  };

  return { httpServer, close };
}
