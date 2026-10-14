import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
        },
      },
    },
  );
  const { data: { user }, error } = await supabase.auth.getUser();
  const signedIn = !error && Boolean(user);
  const pathname = request.nextUrl.pathname;
  const protectedRoute = ["/dashboard", "/projects"].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  const authRoute = ["/login", "/signup"].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  const destination = !signedIn && protectedRoute ? "/login"
    : signedIn && authRoute ? "/dashboard" : null;

  if (destination) {
    const url = request.nextUrl.clone();
    url.pathname = destination;
    url.search = "";
    const redirectResponse = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    for (const name of ["cache-control", "expires", "pragma"]) {
      const value = response.headers.get(name);
      if (value) redirectResponse.headers.set(name, value);
    }
    return redirectResponse;
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|map|woff|woff2|ttf|otf|eot|txt|xml|pdf|webmanifest)$).*)"],
};
