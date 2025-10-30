import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { sanitizeRedirectPath } from "@/utils/lib/sanitize-redirect";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isApiRoute = pathname.startsWith("/api");

  // Public routes that don't require authentication
  const publicRoutes = [
    "/login",
    "/auth/callback",
    "/auth/confirm",
    "/error",
    "/auth/auth-code-error",
    "/tos",
  ];
  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // Redirect unauthenticated users to login
  if (!user) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isPublicRoute && pathname !== "/") {
      const originPath = sanitizeRedirectPath(
        `${request.nextUrl.pathname}${request.nextUrl.search}${
          request.nextUrl.hash ?? ""
        }`
      );
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.search = "";
      if (originPath && originPath !== "/login") {
        loginUrl.searchParams.set("origin", originPath);
      }
      return NextResponse.redirect(loginUrl, 302);
    }
  }

  // Auth guard for authenticated users
  if (user && !isPublicRoute) {
    // Get user profile and role
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("userid, username, roleid, is_guruwali")
      .eq("userid", user.id)
      .single();

    if (profile?.roleid) {
      // Get role name
      const { data: roleData } = await supabase
        .from("role")
        .select("rolename")
        .eq("roleid", profile.roleid)
        .single();

      const roleName = roleData?.rolename;
      const normalizedRoleName = roleName?.toLowerCase();
      const roleKey = normalizedRoleName ?? roleName ?? "";

      // Differentiate between having the guruwali ROLE vs having guruwali access flag.
      // Only users whose role is explicitly 'guruwali' or have roleid 6 are considered
      // guruwali for landing-page redirects. Users with `is_guruwali` may have extra
      // access but shouldn't change their default landing page if their role is 'teacher'.
      const hasGuruWaliAccess = profile?.is_guruwali === true;
      const isGuruWaliRole = roleKey === "guruwali" || profile?.roleid === 6;
      const canAccessGuruwali = isGuruWaliRole || hasGuruWaliAccess;

      // Log role resolution for debugging incorrect redirects (will appear in server logs)
      try {
        console.log("middleware: role resolution", {
          userid: profile?.userid,
          roleid: profile?.roleid,
          is_guruwali: profile?.is_guruwali,
          roleKey,
          hasGuruWaliAccess,
          isGuruWaliRole,
          canAccessGuruwali,
          pathname,
        });
      } catch (e) {
        // ignore
      }

      // Route protection based on role
      if (
        pathname.startsWith("/dashboard") &&
        roleKey !== "admin" &&
        roleKey !== "teacher"
      ) {
        // Redirect to appropriate role page instead of unknown
        switch (roleKey) {
          case "teacher":
            return NextResponse.redirect(new URL("/guru", request.url), 302);
          case "guruwali":
            return NextResponse.redirect(
              new URL("/guruwali", request.url),
              302
            );
          case "student":
            return NextResponse.redirect(new URL("/siswa", request.url), 302);
          case "parent":
            return NextResponse.redirect(
              new URL("/orangtua", request.url),
              302
            );
          default:
            return NextResponse.redirect(new URL("/unknown", request.url), 302);
        }
      }

      if (pathname.startsWith("/siswa") && roleKey !== "student") {
        // Redirect to appropriate role page instead of unknown
        switch (roleKey) {
          case "admin":
            return NextResponse.redirect(
              new URL("/dashboard", request.url),
              302
            );
          case "teacher":
            return NextResponse.redirect(new URL("/guru", request.url), 302);
          case "guruwali":
            return NextResponse.redirect(
              new URL("/guruwali", request.url),
              302
            );
          case "parent":
            return NextResponse.redirect(
              new URL("/orangtua", request.url),
              302
            );
          default:
            return NextResponse.redirect(new URL("/unknown", request.url), 302);
        }
      }

      const isTeacher = roleKey === "teacher";

      // If accessing /guru, allow teachers or users with guruwali access
      if (pathname.startsWith("/guru") && !isTeacher && !canAccessGuruwali) {
        switch (roleKey) {
          case "admin":
            return NextResponse.redirect(
              new URL("/dashboard", request.url),
              302
            );
          case "student":
            return NextResponse.redirect(new URL("/siswa", request.url), 302);
          case "parent":
            return NextResponse.redirect(
              new URL("/orangtua", request.url),
              302
            );
          default:
            return NextResponse.redirect(new URL("/unknown", request.url), 302);
        }
      }

      // If accessing /guruwali, require either the guruwali role or the access flag
      if (pathname.startsWith("/guruwali") && !canAccessGuruwali) {
        switch (roleKey) {
          case "admin":
            return NextResponse.redirect(
              new URL("/dashboard", request.url),
              302
            );
          case "teacher":
            return NextResponse.redirect(new URL("/guru", request.url), 302);
          case "student":
            return NextResponse.redirect(new URL("/siswa", request.url), 302);
          case "parent":
            return NextResponse.redirect(
              new URL("/orangtua", request.url),
              302
            );
          default:
            return NextResponse.redirect(new URL("/unknown", request.url), 302);
        }
      }

      // If accessing /kepsek, require the kepsek role
      if (pathname.startsWith("/kepsek") && roleKey !== "kepsek") {
        switch (roleKey) {
          case "admin":
            return NextResponse.redirect(new URL("/dashboard", request.url), 302);
          case "teacher":
            return NextResponse.redirect(new URL("/guru", request.url), 302);
          case "guruwali":
            return NextResponse.redirect(new URL("/guruwali", request.url), 302);
          case "student":
            return NextResponse.redirect(new URL("/siswa", request.url), 302);
          case "parent":
            return NextResponse.redirect(new URL("/orangtua", request.url), 302);
          default:
            return NextResponse.redirect(new URL("/unknown", request.url), 302);
        }
      }

      if (pathname.startsWith("/orangtua") && roleKey !== "parent") {
        // Redirect to appropriate role page instead of unknown
        switch (roleKey) {
          case "admin":
            return NextResponse.redirect(
              new URL("/dashboard", request.url),
              302
            );
          case "teacher":
            return NextResponse.redirect(new URL("/guru", request.url), 302);
          case "guruwali":
            return NextResponse.redirect(
              new URL("/guruwali", request.url),
              302
            );
          case "student":
            return NextResponse.redirect(new URL("/siswa", request.url), 302);
          default:
            return NextResponse.redirect(new URL("/unknown", request.url), 302);
        }
      }

      // Users with role 'unknown' can only access /unknown
      if (roleKey === "unknown" && pathname !== "/unknown") {
        return NextResponse.redirect(new URL("/unknown", request.url), 302);
      }

      // Redirect root path based on role
      if (pathname === "/") {
        if (roleKey === "admin") {
          return NextResponse.redirect(new URL("/dashboard", request.url), 302);
        }
        if (roleKey === "student") {
          return NextResponse.redirect(new URL("/siswa", request.url), 302);
        }
        // Prefer guruwali when the user has the guruwali ROLE (roleid 6 or rolename 'guruwali').
        // Do NOT use the `is_guruwali` flag alone for the landing page decision so teachers
        // who only have the guruwali access flag don't get redirected to /guruwali by default.
        if (isGuruWaliRole) {
          return NextResponse.redirect(new URL("/guruwali", request.url), 302);
        }
        // Redirect kepsek to their panel
        if (roleKey === "kepsek") {
          return NextResponse.redirect(new URL("/kepsek", request.url), 302);
        }
        if (roleKey === "teacher") {
          return NextResponse.redirect(new URL("/guru", request.url), 302);
        }
        if (roleKey === "parent") {
          return NextResponse.redirect(new URL("/orangtua", request.url), 302);
        }
        if (roleKey === "unknown") {
          return NextResponse.redirect(new URL("/unknown", request.url), 302);
        }
        return NextResponse.redirect(new URL("/unknown", request.url), 302);
      }
    } else {
      // No profile found, redirect to unknown
      if (pathname !== "/unknown") {
        return NextResponse.redirect(new URL("/unknown", request.url), 302);
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
