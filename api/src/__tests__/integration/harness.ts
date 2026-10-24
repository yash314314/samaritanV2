import "./testEnv";
import { createServer, type Server } from "http";
import type { AddressInfo } from "net";
import { createApp } from "../../app";
import { initWebSocket } from "../../websocket/manager";
import { prisma } from "../../prisma";
import { DASHBOARD_ORIGIN } from "./testEnv";
import "../../websocket/handlers";

export { prisma, DASHBOARD_ORIGIN };

export interface TestServer {
  baseUrl: string;
  wsUrl: string;
  close: () => Promise<void>;
}

export async function startServer(): Promise<TestServer> {
  const server: Server = createServer(createApp());
  initWebSocket(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    wsUrl: `ws://127.0.0.1:${port}/ws`,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

/** Empties every user-owned table (all cascade from User). */
export async function resetDatabase() {
  await prisma.$executeRawUnsafe('TRUNCATE "User" CASCADE');
}

export interface JsonResponse<T = any> {
  status: number;
  body: T;
  headers: Headers;
  cookies: string[];
}

export async function call<T = any>(
  server: TestServer,
  method: string,
  path: string,
  options: { token?: string; body?: unknown; headers?: Record<string, string>; cookie?: string; origin?: string | null } = {}
): Promise<JsonResponse<T>> {
  const headers: Record<string, string> = { ...(options.headers || {}) };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.cookie) headers.Cookie = options.cookie;
  if (options.origin) headers.Origin = options.origin;
  const response = await fetch(`${server.baseUrl}${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    redirect: "manual",
  });
  const text = await response.text();
  let body: any = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // Non-JSON body stays as text.
  }
  return { status: response.status, body, headers: response.headers, cookies: response.headers.getSetCookie() };
}

/** "name=value" of the refresh cookie from Set-Cookie headers, or null. */
export function refreshCookie(cookies: string[]): string | null {
  const header = cookies.find((value) => value.startsWith("samaritan_refresh="));
  if (!header) return null;
  const pair = header.split(";")[0];
  return pair === "samaritan_refresh=" ? null : pair;
}

let counter = 0;

export async function registerUser(
  server: TestServer,
  overrides: { email?: string; password?: string; name?: string } = {}
) {
  counter += 1;
  const email = overrides.email ?? `user${counter}-${Date.now()}@example.test`;
  const password = overrides.password ?? "correct horse battery staple";
  const response = await call(server, "POST", "/api/auth/register", {
    origin: DASHBOARD_ORIGIN,
    body: { email, password, name: overrides.name ?? `User ${counter}` },
  });
  if (response.status !== 201) throw new Error(`register failed: ${response.status} ${JSON.stringify(response.body)}`);
  return {
    email,
    password,
    userId: response.body.user.id as string,
    accessToken: response.body.accessToken as string,
    cookie: refreshCookie(response.cookies)!,
  };
}
