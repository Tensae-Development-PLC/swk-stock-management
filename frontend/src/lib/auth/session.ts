const ACCESS = "swk_access";
const REFRESH = "swk_refresh";
const FLAG = "swk_session";

function store(remember: boolean) {
  return remember ? localStorage : sessionStorage;
}

export function setSession(
  accessToken: string,
  refreshToken: string,
  remember: boolean,
) {
  localStorage.removeItem(ACCESS);
  localStorage.removeItem(REFRESH);
  sessionStorage.removeItem(ACCESS);
  sessionStorage.removeItem(REFRESH);
  store(remember).setItem(ACCESS, accessToken);
  store(remember).setItem(REFRESH, refreshToken);
  document.cookie = `${FLAG}=1; path=/; max-age=${remember ? 60 * 60 * 24 * 7 : 60 * 60 * 12}; SameSite=Lax`;
}

export function getAccessToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS) ?? sessionStorage.getItem(ACCESS);
}

export function getRefreshToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH) ?? sessionStorage.getItem(REFRESH);
}

export function clearSession() {
  localStorage.removeItem(ACCESS);
  localStorage.removeItem(REFRESH);
  sessionStorage.removeItem(ACCESS);
  sessionStorage.removeItem(REFRESH);
  document.cookie = `${FLAG}=; path=/; max-age=0`;
}

export function hasSessionCookie() {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((c) => c.trim().startsWith(`${FLAG}=`));
}
