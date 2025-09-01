# Use‑Case Duplication Guide

This guide explains how to recreate the same use case (simple cookie‑based auth with Server Actions and a protected page) in your own Next.js App Router project, without copying build configs. Focus is on concepts and minimal patterns you can re‑implement.

What you will build:
- A login form that verifies fixed credentials via a Server Action.
- A short‑lived session stored as a signed JWT in an httpOnly "session" cookie.
- Middleware that refreshes the session cookie while you browse.
- A protected page that redirects unauthenticated users.
- A simple form on the protected page that sets a short‑lived, non‑httpOnly "flash" message and redirects.

Note: Cookies can only be modified in a Server Action or Route Handler in App Router.

---

## 1) Core pieces to implement

1. Session helpers (server utilities)
   - Encrypt/sign and decrypt/verify a JWT payload containing `{ user, expires }`.
   - Read and write the `session` cookie using Next.js `cookies()` API (from `next/headers`).
   - Provide functions:
     - `encrypt(payload)`: returns signed JWT.
     - `decrypt(token)`: verifies and returns payload.
     - `login(formData)`: Server Action that validates credentials, creates session, writes `session` cookie.
     - `logout()`: Server Action that clears the `session` cookie.
     - `getSession()`: reads the cookie and returns decoded session or null.
     - `updateSession(request)`: refresh logic used by middleware to extend expiry while navigating.
   - Important: add "use server" inside any function that mutates cookies (e.g., `login`, `logout`).

2. Middleware for session refresh
   - A middleware that calls `updateSession(request)` to refresh the `session` cookie’s expiry.
   - Configure it to run on application routes and skip static assets/Next internals.

3. Public page with login/logout
   - A Server Component rendering two forms:
     - Login form with an inline Server Action that calls `await login(formData)` then redirects.
     - Logout form with an inline Server Action that calls `await logout()` then redirects.
   - Display the current session object for visibility (optional).

4. Protected page
   - At the top, call `await getSession()` (Server Component) and `redirect("/")` if no `session.user`.
   - Render a simple form that simulates a save via a Server Action.
   - Inside that action:
     - Re-check `getSession()` to ensure the user is still authenticated.
     - Simulate some work, then set a short‑lived, non‑httpOnly `flash` cookie using `cookies().set(...)` and `redirect` back.
   - During render, read `cookies().get("flash")`; do not write/clear cookies during render. Let short expiry clear it or clear via another action.

---

## 2) Minimal code patterns (pseudo‑snippets)

Session helpers (server utilities):

```ts
// lib (server utilities)
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const key = new TextEncoder().encode("your-secret");

export async function encrypt(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("60 sec from now")
    .sign(key);
}

export async function decrypt(token: string) {
  const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
  return payload as any;
}

export async function login(formData: FormData) {
  "use server";
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  // Replace with your own check
  if (email !== "u@e.com" || password !== "123") throw new Error("Invalid");
  const user = { email, name: "John" };
  const expires = new Date(Date.now() + 60 * 1000);
  const session = await encrypt({ user, expires });
  cookies().set("session", session, { httpOnly: true, expires });
}

export async function logout() {
  "use server";
  cookies().set("session", "", { expires: new Date(0) });
}

export async function getSession() {
  const token = cookies().get("session")?.value;
  if (!token) return null;
  return await decrypt(token);
}

export async function updateSession(request: NextRequest) {
  const token = request.cookies.get("session")?.value;
  if (!token) return;
  const parsed: any = await decrypt(token);
  parsed.expires = new Date(Date.now() + 60 * 1000);
  const res = NextResponse.next();
  res.cookies.set({ name: "session", value: await encrypt(parsed), httpOnly: true, expires: parsed.expires });
  return res;
}
```

Middleware:

```ts
// middleware.ts
import type { NextRequest } from "next/server";
import { updateSession } from "./lib";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
```

Public page with forms:

```tsx
// app/page.tsx (Server Component)
import { redirect } from "next/navigation";
import { getSession, login, logout } from "@/lib";

export default async function Page() {
  const session = await getSession();
  return (
    <section>
      <form action={async (formData) => { "use server"; await login(formData); redirect("/"); }}>
        <input type="email" name="email" required />
        <input type="password" name="password" required />
        <button type="submit">Login</button>
      </form>

      <form action={async () => { "use server"; await logout(); redirect("/"); }}>
        <button type="submit">Logout</button>
      </form>

      <pre>{JSON.stringify(session, null, 2)}</pre>
      <a href="/protected">Go to protected page</a>
    </section>
  );
}
```

Protected page with flash:

```tsx
// app/protected/page.tsx (Server Component)
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSession } from "@/lib";

export default async function ProtectedPage() {
  const session = await getSession();
  if (!session?.user) redirect("/");

  const flash = cookies().get("flash");

  return (
    <section>
      {flash?.value ? <p style={{ color: "green" }}>{flash.value}</p> : null}

      <form
        action={async (formData) => {
          "use server";
          const s = await getSession();
          if (!s?.user) redirect("/");
          const title = String(formData.get("title") || "");
          await new Promise((r) => setTimeout(r, 300));
          cookies().set("flash", title ? `Saved: ${title}` : "Saved", {
            expires: new Date(Date.now() + 5 * 1000),
          });
          redirect("/protected");
        }}
      >
        <input name="title" />
        <button type="submit">Save</button>
      </form>
    </section>
  );
}
```

---

## 3) Rules and pitfalls
- Only mutate cookies in Server Actions or Route Handlers.
- Keep the session cookie httpOnly to prevent client‑side access; use a separate non‑httpOnly cookie for transient UI messages.
- Re‑validate authentication inside each server action that depends on auth.
- Avoid clearing cookies during render in Server Components; prefer short expirations or clear inside an action.
- Short‑lived sessions are useful for demos; choose durations appropriate for your app.

---

## 4) Step‑by‑step to recreate in a fresh app
1. Create a new App Router project (any setup you prefer).
2. Add a `lib` module with the helpers above (encrypt/decrypt/login/logout/getSession/updateSession).
3. Add `middleware.ts` that calls `updateSession` and configure a matcher to skip static assets.
4. Create `app/page.tsx` with login and logout forms invoking Server Actions and redirecting.
5. Create `app/protected/page.tsx` that:
   - Redirects if `getSession()` has no user.
   - Renders a form with a Server Action that sets a short‑lived `flash` cookie and redirects back.
6. Test the flow end‑to‑end (see checklist below).

---

## 5) Test checklist
- Visiting `/` shows login form; submitting valid credentials redirects back with a session shown.
- Visiting `/protected` while logged out redirects to `/`.
- Visiting `/protected` while logged in renders the page.
- Submitting the dummy form on `/protected` shows a green success message; the message disappears shortly after.
- Leaving the app idle long enough expires the session; navigating again should refresh it if middleware runs, otherwise you’ll be logged out.

---

## 6) What to change for your own app
- Replace hard‑coded credentials with real authentication (database, OAuth, etc.).
- Extend the session payload with whatever user data you need.
- Adjust expiration durations to fit your security posture.
- Replace the flash message cookie with a more robust mechanism (e.g., redirect URL params or server‑rendered feedback).

This guide avoids build and tooling configuration. It focuses on the minimal patterns you can transplant to reproduce the same behavior in your own project.
