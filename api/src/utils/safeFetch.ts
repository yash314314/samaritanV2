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

// Non-public ranges. BlockList also applies the IPv4 rules to IPv4-mapped
// IPv6 forms, which URL parsing rewrites ([::ffff:127.0.0.1] -> ::ffff:7f00:1).
const PRIVATE_RANGES = new net.BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) {
  PRIVATE_RANGES.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  // IPv4-compatible (includes :: and ::1), NAT64, 6to4 (both embed an IPv4
  // address a gateway may route), discard, documentation, ULA, link-local, multicast.
  ["::", 96], ["64:ff9b::", 96], ["64:ff9b:1::", 48], ["2002::", 16], ["100::", 64],
  ["2001:db8::", 32], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
] as const) {
  PRIVATE_RANGES.addSubnet(network, prefix, "ipv6");
}

export function isPrivateAddress(address: string): boolean {
  const bare = address.replace(/^\[|\]$/g, "");
  const family = net.isIP(bare);
  if (family === 0) return true; // not an address at all: refuse rather than guess
  return PRIVATE_RANGES.check(bare, family === 4 ? "ipv4" : "ipv6");
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
    const literal = url.hostname.replace(/^\[|\]$/g, "");
    if (guard && net.isIP(literal) && isPrivateAddress(literal)) {
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
