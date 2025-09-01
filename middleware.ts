import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/session";

export async function middleware(req: NextRequest) {
  const res = await updateSession(req);
  return res ?? NextResponse.next();
}

export const config = {
  matcher: [
    // run on all routes except static files and api auth callback if any
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|svg|ico)).*)",
  ],
};
