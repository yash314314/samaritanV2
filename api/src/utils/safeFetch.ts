import dns from "dns";
import http from "http";
import https from "https";
import net from "net";
import type { LookupFunction } from "net";
import { resolveDatabaseConfig } from "../config/database";

// Fetches user-supplied URLs (calendar feeds) without letting them reach the
// server's own network. The address check runs inside the socket's DNS
// lookup, so the address that was checked is the address that is connected:
// a hostname cannot pass the check and then re-resolve to 127.0.0.1.

export class UnsafeUrlError extends Error {}

const MAX_REDIRECTS = 3;

function blockPrivateTargets(): boolean {
  const override = process.env.ALLOW_PRIVATE_FETCH?.trim().toLowerCase();
  if (override === "true") return false;
  if (override === "false") return true;
  // A local install fetching from its own LAN only exposes its owner to themselves.
  return resolveDatabaseConfig().target === "global" || process.env.NODE_ENV === "production";
}

function ipv4Private(address: string): boolean {
  const [a, b] = address.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

export function isPrivateAddress(address: string): boolean {
  if (net.isIPv4(address)) return ipv4Private(address);
  const lower = address.toLowerCase();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (mapped) return ipv4Private(mapped[1]);
  return (
    lower === "::" ||
    lower === "::1" ||
    lower.startsWith("fc") ||
    lower.startsWith("fd") ||
    lower.startsWith("fe8") ||
    lower.startsWith("fe9") ||
    lower.startsWith("fea") ||
    lower.startsWith("feb") ||
    lower.startsWith("ff")
  );
}

const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, "", 0);
    const list = addresses as dns.LookupAddress[];
    const blocked = list.find((entry) => isPrivateAddress(entry.address));
    if (blocked || list.length === 0) {
      return callback(new UnsafeUrlError(`Refusing to fetch ${hostname}: it resolves to a private address`), "", 0);
    }
    if ((options as dns.LookupOptions).all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
    callback(null, list[0].address, list[0].family);
  });
};

function parseTarget(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim().replace(/^webcals?:\/\//i, "https://"));
  } catch {
    throw new UnsafeUrlError("Invalid URL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new UnsafeUrlError("Only http(s) URLs can be imported");
  if (url.username || url.password) throw new UnsafeUrlError("URLs with embedded credentials are not accepted");
  return url;
}

/** GET a text resource from a user-supplied URL with size, time and network-range limits. */
export async function fetchUntrustedText(
  raw: string,
  options: { maxBytes?: number; timeoutMs?: number } = {}
): Promise<string> {
  const maxBytes = options.maxBytes ?? 5 * 1024 * 1024;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const guard = blockPrivateTargets();
  let url = parseTarget(raw);

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    if (guard && net.isIP(url.hostname.replace(/^\[|\]$/g, "")) && isPrivateAddress(url.hostname.replace(/^\[|\]$/g, ""))) {
      throw new UnsafeUrlError("Refusing to fetch a private address");
    }
    const result = await new Promise<{ status: number; location?: string; body?: string }>((resolve, reject) => {
      const client = url.protocol === "https:" ? https : http;
      const request = client.get(
        url,
        { timeout: timeoutMs, lookup: guard ? guardedLookup : undefined, headers: { Accept: "text/calendar, text/plain;q=0.9, */*;q=0.1" } },
        (response) => {
          const status = response.statusCode || 0;
          if (status >= 300 && status < 400 && response.headers.location) {
            response.resume();
            return resolve({ status, location: response.headers.location });
          }
          if (status < 200 || status >= 300) {
            response.resume();
            return reject(new Error(`Feed answered HTTP ${status}`));
          }
          const chunks: Buffer[] = [];
          let size = 0;
          response.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > maxBytes) {
              request.destroy(new Error(`Feed is larger than ${Math.round(maxBytes / 1024 / 1024)} MB`));
              return;
            }
            chunks.push(chunk);
          });
          response.on("end", () => resolve({ status, body: Buffer.concat(chunks).toString("utf8") }));
          response.on("error", reject);
        }
      );
      request.on("timeout", () => request.destroy(new Error("Feed request timed out")));
      request.on("error", reject);
    });
    if (result.body !== undefined) return result.body;
    url = parseTarget(new URL(result.location!, url).toString());
  }
  throw new Error("Too many redirects");
}
