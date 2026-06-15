export const SIDEBAR_COOKIE = "pc_sidebar"; // "collapsed" | "expanded"

/** Client-side toggle: writes the cookie so SSR matches on next load. */
export function setSidebarCookie(collapsed: boolean) {
  document.cookie = `${SIDEBAR_COOKIE}=${collapsed ? "collapsed" : "expanded"}; path=/; max-age=${60 * 60 * 24 * 365}`;
}
