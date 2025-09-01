import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

// Very small JWT-like signing using Web Crypto (HMAC-SHA256) to avoid extra deps.
// Token format: base64url(header).base64url(payload).base64url(signature)
// This is sufficient for a demo and NOT for production.

const secret = process.env.SESSION_SECRET || "dev-secret-change-me";

function b64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  const str = Buffer.from(bytes).toString("base64");
  return str.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function b64urlDecode(input: string): Uint8Array {
  input = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = input.length % 4 === 0 ? 0 : 4 - (input.length % 4);
  const normalized = input + "=".repeat(pad);
  return new Uint8Array(Buffer.from(normalized, "base64"));
}

async function hmac(data: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  return crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
}

export type SessionPayload = {
  user: { name: string } | null;
  expires: number; // ms epoch
};

export async function encrypt(payload: SessionPayload): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const encHeader = b64url(JSON.stringify(header));
  const encPayload = b64url(JSON.stringify(payload));
  const toSign = `${encHeader}.${encPayload}`;
  const sig = await hmac(toSign);
  const encSig = b64url(sig);
  return `${encHeader}.${encPayload}.${encSig}`;
}

export async function decrypt(token: string): Promise<SessionPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [encHeader, encPayload, encSig] = parts;
    const toSign = `${encHeader}.${encPayload}`;
    const expected = await hmac(toSign);
    const expectedStr = b64url(expected);
    if (expectedStr !== encSig) return null;
    const payloadBytes = b64urlDecode(encPayload);
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as SessionPayload;
    return payload;
  } catch {
    return null;
  }
}

const SESSION_COOKIE = "session";

function shortExpiry(msFromNow: number) {
  return Date.now() + msFromNow;
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await decrypt(token);
  if (!payload) return null;
  if (payload.expires < Date.now()) return null;
  return payload;
}

export async function updateSession(req: NextRequest): Promise<NextResponse | void> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return; // nothing to do
  const payload = await decrypt(token);
  if (!payload) return;
  // If within 2 minutes of expiry, extend by 10 minutes
  const remaining = payload.expires - Date.now();
  if (remaining < 2 * 60 * 1000) {
    const refreshed: SessionPayload = {
      ...payload,
      expires: shortExpiry(10 * 60 * 1000),
    };
    const newToken = await encrypt(refreshed);
    const res = NextResponse.next();
    res.cookies.set(SESSION_COOKIE, newToken, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 10 * 60, // seconds
    });
    return res;
  }
}

export async function login(formData: FormData) {
  "use server";
  const username = String(formData.get("username") || "");
  const password = String(formData.get("password") || "");
  // Very basic fixed credentials demo
  if (username !== "admin" || password !== "password") {
    throw new Error("Invalid credentials");
  }
  const payload: SessionPayload = {
    user: { name: "Admin" },
    expires: shortExpiry(10 * 60 * 1000),
  };
  const token = await encrypt(payload);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });
}

export async function logout() {
  "use server";
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
