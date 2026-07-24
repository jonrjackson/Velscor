import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicPortalRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const host = req.headers.get("host") || "";
  const isPortalHost = host.startsWith("app.");

  if (isPortalHost && !isPublicPortalRoute(req)) {
    await auth.protect();
  }

  const url = req.nextUrl.clone();
  url.pathname = `${isPortalHost ? "/portal" : "/marketing"}${url.pathname}`;
  return NextResponse.rewrite(url);
});

export const config = {
  matcher: [
    "/((?!api|taskpane\\.html|taskpane\\.js|taskpane\\.js\\.LICENSE\\.txt|manifest\\.xml|assets|robots\\.txt|og-image\\.png|_next/static|_next/image|favicon\\.ico|icon\\.png).*)",
  ],
};
