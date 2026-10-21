/**
 * DIGITALSMOD.SITE — Router & Synchronizer (router.js)
 * Tên miền chính thức: https://digitalsmod.site
 *
 * Hỗ trợ 2 chế độ hoạt động:
 * 1. Cloudflare Workers / Cloudflare Pages Functions (_worker.js / router.js):
 *    Định tuyến các request /admin, /admin/*, /adminn.html về trang quản trị `adminn.html`,
 *    kiểm tra bảo mật cho `/go/[id]`, và định tuyến các đường dẫn người dùng/seller về `index.html`.
 * 2. Browser Client Router & Firebase Realtime Sync:
 *    Điều hướng SPA mượt không reload trang, đồng bộ dữ liệu thời gian thực với Firebase
 *    Realtime Database (ideo-dd376) và giữa 2 trang `index.html` <-> `adminn.html`.
 */

const APP_BASE_URL = "https://digitalsmod.site";
const FIREBASE_DB_URL = "https://ideo-dd376-default-rtdb.asia-southeast1.firebasedatabase.app";

const USER_SPA_ROUTES = [
  "/",
  "/login",
  "/register",
  "/dashboard",
  "/tasks",
  "/verify",
  "/seller",
  "/seller/links",
  "/seller/analytics",
  "/wallet",
  "/withdraw",
  "/notifications",
  "/settings"
];

function applySecurityHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "SAMEORIGIN");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

// -----------------------------------------------------------------------------
// PHẦN A: CLOUDFLARE WORKER / PAGES EDGE ROUTER
// -----------------------------------------------------------------------------
const cloudflareWorkerHandler = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, "") || "/";

    if (url.hostname === "dgtraffic.site" || url.hostname.endsWith(".dgtraffic.site")) {
      return Response.redirect(APP_BASE_URL + url.pathname + url.search, 301);
    }

    if (
      pathname === "/adminn.html" ||
      pathname === "/adminn" ||
      pathname === "/admin" ||
      pathname.startsWith("/admin/")
    ) {
      if (env && env.ASSETS) {
        const adminAssetUrl = new URL("/adminn.html" + url.search, url.origin);
        const res = await env.ASSETS.fetch(new Request(adminAssetUrl.toString(), request));
        return applySecurityHeaders(res);
      }
    }

    if (
      pathname === "/index.html" ||
      pathname.startsWith("/go/") ||
      USER_SPA_ROUTES.includes(pathname)
    ) {
      if (env && env.ASSETS) {
        const userAssetUrl = new URL("/index.html" + url.search, url.origin);
        const res = await env.ASSETS.fetch(new Request(userAssetUrl.toString(), request));
        return applySecurityHeaders(res);
      }
    }

    if (env && env.ASSETS) {
      const res = await env.ASSETS.fetch(request);
      if (res.status === 404) {
        const fallbackUrl = new URL("/index.html", url.origin);
        return applySecurityHeaders(await env.ASSETS.fetch(new Request(fallbackUrl.toString(), request)));
      }
      return applySecurityHeaders(res);
    }

    return new Response("DIGITALSMOD.SITE Edge Router Ready", { status: 200 });
  }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = cloudflareWorkerHandler;
}

// -----------------------------------------------------------------------------
// PHẦN B: BROWSER CLIENT ROUTER & FIREBASE REALTIME DATABASE BRIDGE
// -----------------------------------------------------------------------------
if (typeof window !== "undefined") {
  window.DigitalsModRouter = {
    APP_BASE_URL: APP_BASE_URL,
    FIREBASE_DB_URL: FIREBASE_DB_URL,
    STORAGE_KEY: "digitalsmod_shared_db_v2",
    SESSION_KEY: "digitalsmod_session_v2",
    channel: typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("digitalsmod_sync_v2") : null,

    loadSharedDb: function(defaultDb) {
      try {
        const raw = window.localStorage.getItem(this.STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.system && parsed.tasks) return parsed;
        }
      } catch (e) {}
      return defaultDb;
    },

    saveSharedDb: function(db) {
      try {
        window.localStorage.setItem(this.STORAGE_KEY, JSON.stringify(db));
        if (this.channel) {
          this.channel.postMessage({ type: "DB_UPDATED", timestamp: Date.now() });
        }
      } catch (e) {}
      this.syncToFirebaseRest(db);
    },

    syncToFirebaseRest: function(db) {
      try {
        fetch(FIREBASE_DB_URL + "/digitalsmod_snapshot.json", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            updatedAt: Date.now(),
            adminKpi: db.adminKpi,
            settings: db.system ? db.system.settings : null
          })
        }).catch(function() {});
      } catch (e) {}
    },

    resolveInitialRoute: function(defaultRoute) {
      try {
        const sp = new URLSearchParams(window.location.search || "");
        if (sp.get("go")) {
          return "/go/" + encodeURIComponent(sp.get("go"));
        }
        if (sp.get("verify") === "1" || (sp.get("task") && sp.get("attempt") && sp.get("token"))) {
          return "/verify?" + sp.toString();
        }
        if (sp.get("route")) {
          return sp.get("route");
        }
        const hash = window.location.hash ? window.location.hash.slice(1) : "";
        if (hash && hash.startsWith("/")) return hash;
        const path = window.location.pathname;
        const search = window.location.search || "";
        if (path && path !== "/" && !path.endsWith(".html") && !path.includes("/working_dir/")) {
          return path + search;
        }
      } catch (e) {}
      return defaultRoute || "/";
    },

    pushRoute: function(route, isAdminPage) {
      try {
        if (window.history && window.history.replaceState) {
          if (route.indexOf("/go/") === 0) {
            const tid = route.slice(4);
            window.history.replaceState(null, "", "?go=" + encodeURIComponent(tid) + "#" + route);
            return false;
          }
        }
        window.location.hash = route;
      } catch (e) {}
      return false;
    }
  };
}
