import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const url = req.nextUrl.clone();

  const prefix = host.startsWith("app.") ? "/portal" : "/marketing";
  url.pathname = `${prefix}${url.pathname}`;

  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    "/((?!api|taskpane\\.html|taskpane\\.js|taskpane\\.js\\.LICENSE\\.txt|manifest\\.xml|assets|robots\\.txt|og-image\\.png|_next/static|_next/image|favicon\\.ico|icon\\.png).*)",
  ],
};
