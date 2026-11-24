import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Looks up the price of one unit from a web page or JSON API the user named. Nothing is saved here: the price goes
 * back to the Update page's box for the user to check and save.
 *
 * `extract` says where the number is: `/regex/flags` (its first group, or the whole match, is the price) for any
 * page, or a dot path like `data.0.price` or `bitcoin.thb` into JSON. Left empty, it tries the usual places: a
 * lone number, a "price"-like key in JSON, or the price tags shops and finance pages mark up in HTML.
 */
export type Fetched = ({ price: number } | { error: string }) & {
  /** The start of what the page answered (JSON pretty-printed), for checking a path or regex against. */
  preview?: string;
};

const MAX_BYTES = 3_000_000;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 4;
const PREVIEW_CHARS = 6_000;

export async function fetchPrice(url: string, extract: string | null): Promise<Fetched> {
  let body: string;
  let json: unknown = undefined;
  let status: string | null = null;
  try {
    const res = await get(url);
    body = await readCapped(res);
    if (!res.ok) status = `The page answered ${res.status} ${res.statusText}.`.replace(" .", ".");
    const type = res.headers.get("content-type") ?? "";
    if (type.includes("json") || /^\s*[[{]/.test(body)) {
      try {
        json = JSON.parse(body);
      } catch {
        // Not JSON after all: read it as text.
      }
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't reach that page." };
  }

  const text = json !== undefined ? JSON.stringify(json, null, 2) : body;
  const preview = text.length > PREVIEW_CHARS ? `${text.slice(0, PREVIEW_CHARS)}\n…` : text;
  if (status) return { error: status, preview };
  return { ...extractPrice(body, json, extract?.trim() ?? ""), preview };
}

function extractPrice(body: string, json: unknown, rule: string): Fetched {
  let found: number | null;
  if (rule.startsWith("/")) {
    const m = /^\/([\s\S]+)\/([a-z]*)$/.exec(rule);
    if (!m) return { error: "Write the regex as /pattern/ (flags after the last slash are optional)." };
    let re: RegExp;
    try {
      re = new RegExp(m[1], m[2].replace(/g/g, ""));
    } catch {
      return { error: "That regex isn't valid." };
    }
    const hit = re.exec(body);
    found = hit ? toNumber(hit[1] ?? hit[0]) : null;
    if (found === null) return { error: "The regex didn't match a number on the page." };
  } else if (rule) {
    if (json === undefined) return { error: "The page isn't JSON, so a path can't be used. Use a /regex/ instead." };
    found = toNumber(atPath(json, rule));
    if (found === null) return { error: `No number at "${rule}" in the JSON.` };
  } else {
    found = json !== undefined ? guessJson(json) : guessHtml(body);
    if (found === null) {
      return { error: "Couldn't find a price on that page. Add a JSON path or a /regex/ to say where it is (the page may also need JavaScript to show it)." };
    }
  }
  if (!(found >= 0)) return { error: "The price found isn't a positive number." };
  return { price: found };
}

/** Fetches with a timeout, following redirects by hand so every hop is checked to be a public address. */
async function get(raw: string): Promise<Response> {
  let url = parseUrl(raw);
  for (let hop = 0; ; hop++) {
    await assertPublic(url.hostname);
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; price-lookup/1.0)",
        accept: "application/json, text/html;q=0.9, */*;q=0.5",
      },
      cache: "no-store",
    }).catch((e: unknown) => {
      const name = e instanceof Error ? e.name : "";
      throw new Error(name === "TimeoutError" ? "The page took too long to answer." : "Couldn't reach that page.");
    });
    const next = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && next) {
      if (hop >= MAX_REDIRECTS) throw new Error("The page redirected too many times.");
      url = parseUrl(new URL(next, url).toString());
      continue;
    }
    return res;
  }
}

function parseUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("That isn't a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Only http and https links can be fetched.");
  return url;
}

/** Refuses addresses on this machine or a private network, so a link can't be used to poke at them. */
async function assertPublic(host: string) {
  const name = host.replace(/^\[|\]$/g, "");
  const addresses = isIP(name) ? [name] : (await lookup(name, { all: true }).catch(() => { throw new Error("Couldn't find that website."); })).map((a) => a.address);
  if (addresses.some(isPrivate)) throw new Error("That address is on a private network and can't be fetched.");
}

function isPrivate(ip: string): boolean {
  const v4 = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  if (isIP(v4) === 4) {
    const [a, b] = v4.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  const s = ip.toLowerCase();
  return s === "::" || s === "::1" || s.startsWith("fc") || s.startsWith("fd") || s.startsWith("fe80");
}

async function readCapped(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      break; // The price is almost always near the top; read what came.
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/** "1,234.56", "฿ 1 234.56", "$12.3" or 12.3 → the number; anything else → null. */
function toNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const m = /-?\d[\d,\s]*(?:\.\d+)?|-?\.\d+/.exec(v.replace(/ /g, " "));
  if (!m) return null;
  const n = Number(m[0].replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** `a.b.0.c` or `a.b[0].c` into parsed JSON. */
function atPath(json: unknown, path: string): unknown {
  let cur = json;
  for (const key of path.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean)) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

const PRICE_KEYS = ["price", "lastprice", "last_price", "last", "regularmarketprice", "close", "nav", "navprice", "rate", "value", "amount"];

/** A lone number, or the first "price"-like key found going down the JSON. */
function guessJson(json: unknown): number | null {
  const direct = toNumber(json);
  if (direct !== null) return direct;
  const queue: unknown[] = [json];
  for (let i = 0; i < queue.length && i < 5000; i++) {
    const cur = queue[i];
    if (cur === null || typeof cur !== "object") continue;
    const entries = Object.entries(cur as Record<string, unknown>);
    for (const want of PRICE_KEYS) {
      const hit = entries.find(([k, v]) => k.toLowerCase() === want && toNumber(v) !== null);
      if (hit) return toNumber(hit[1]);
    }
    // An object holding exactly one number (like {"thb": 3500000}) is that number.
    const nums = entries.filter(([, v]) => typeof v === "number");
    if (nums.length === 1 && entries.length === 1) return nums[0][1] as number;
    queue.push(...entries.map(([, v]) => v));
  }
  return null;
}

/** The places shops and finance pages mark up a price for search engines. */
function guessHtml(html: string): number | null {
  const patterns = [
    /<meta[^>]+(?:property|name|itemprop)=["'](?:product:price:amount|og:price:amount|price)["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name|itemprop)=["'](?:product:price:amount|og:price:amount|price)["']/i,
    /itemprop=["']price["'][^>]*content=["']([^"']+)["']/i,
    /"price"\s*:\s*"?(-?[\d.,]+)"?/i,
    /data-(?:price|last-price|value)=["']([^"']+)["']/i,
  ];
  for (const re of patterns) {
    const m = re.exec(html);
    const n = m ? toNumber(m[1]) : null;
    if (n !== null) return n;
  }
  return null;
}
