/**
 * API client.
 *
 * The API is served from the same origin as the app (Vercel routes /api/* to
 * the Flask service; in development Vite proxies it), so requests use relative
 * paths. VITE_API_URL only needs setting when the API is hosted elsewhere.
 *
 * Staff requests carry a bearer token (stored in localStorage) instead of a
 * cookie, so the API also works from a different site (Safari blocks
 * third-party cookies). Requests that take more than a few seconds flag the
 * app as "waiting for the server" so the UI can explain free-tier cold starts.
 */
export const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

const SESSION_KEY = "aic.staff.session";
const SLOW_AFTER_MS = 4000;

export class ApiError extends Error {
  constructor(message, status = 0, data = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
    this.fields = data?.fields || {};
  }
}

/* ---------- session ---------- */

export function getSession() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (session?.token && session.expiresAt * 1000 > Date.now()) return session;
  } catch {
    /* storage unavailable or corrupt: treat as signed out */
  }
  return null;
}

export function saveSession(session) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* private mode: the session simply won't survive a reload */
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

const unauthorizedListeners = new Set();
export function onUnauthorized(listener) {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

/* ---------- slow-request tracking ---------- */

let slowCount = 0;
const slowListeners = new Set();
function setSlow(delta) {
  slowCount = Math.max(0, slowCount + delta);
  slowListeners.forEach((listener) => listener(slowCount > 0));
}
export function onSlowChange(listener) {
  slowListeners.add(listener);
  return () => slowListeners.delete(listener);
}

function trackSlow() {
  let flagged = false;
  const timer = setTimeout(() => {
    flagged = true;
    setSlow(1);
  }, SLOW_AFTER_MS);
  return () => {
    clearTimeout(timer);
    if (flagged) setSlow(-1);
  };
}

/* ---------- requests ---------- */

function authHeaders(useAuth) {
  const session = useAuth ? getSession() : null;
  return session ? { Authorization: `Bearer ${session.token}` } : {};
}

function handleFailure(status, data, hadSession) {
  if (status === 401 && hadSession) {
    clearSession();
    unauthorizedListeners.forEach((listener) => listener());
  }
  const message =
    data?.error ||
    (status >= 500
      ? "Something went wrong on the server. Please try again."
      : `The request failed (${status}).`);
  return new ApiError(message, status, data);
}

export async function api(path, { method = "GET", json, form, signal, auth = true } = {}) {
  const headers = authHeaders(auth);
  let body;
  if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  } else if (form) {
    body = form;
  }

  const done = trackSlow();
  let response;
  try {
    response = await fetch(API_BASE + path, { method, headers, body, signal });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new ApiError("We couldn't reach the server. Check your connection and try again.");
  } finally {
    done();
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) throw handleFailure(response.status, data, Boolean(headers.Authorization));
  return data;
}

/** Multipart upload with progress (fetch cannot report upload progress). */
export function upload(path, formData, { method = "POST", auth = true, onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const headers = authHeaders(auth);
    xhr.open(method, API_BASE + path);
    Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));
    const done = trackSlow();

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
      };
    }
    xhr.onload = () => {
      done();
      let data = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* non-JSON body */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(handleFailure(xhr.status, data, Boolean(headers.Authorization)));
    };
    xhr.onerror = () => {
      done();
      reject(new ApiError("We couldn't reach the server. Check your connection and try again."));
    };
    xhr.send(formData);
  });
}

function filenameFrom(response, fallback) {
  const header = response.headers.get("Content-Disposition") || "";
  const star = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (star) return decodeURIComponent(star[1]);
  const plain = header.match(/filename="?([^";]+)"?/i);
  return plain ? plain[1] : fallback;
}

async function fetchBlob(path) {
  const headers = authHeaders(true);
  const done = trackSlow();
  let response;
  try {
    response = await fetch(API_BASE + path, { headers });
  } catch {
    throw new ApiError("We couldn't reach the server. Check your connection and try again.");
  } finally {
    done();
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw handleFailure(response.status, data, Boolean(headers.Authorization));
  }
  return { blob: await response.blob(), response };
}

/** Download an authenticated file and save it with the server-provided name. */
export async function downloadFile(path, fallbackName = "download") {
  const { blob, response } = await fetchBlob(path);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filenameFrom(response, fallbackName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Open an authenticated file (PDF/image) in a new tab. The tab is opened
 *  synchronously so popup blockers allow it, then pointed at the blob. */
export async function openFile(path) {
  const tab = window.open("", "_blank");
  try {
    const { blob } = await fetchBlob(`${path}${path.includes("?") ? "&" : "?"}inline=1`);
    const url = URL.createObjectURL(blob);
    if (tab) tab.location.href = url;
    else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    tab?.close();
    throw error;
  }
}

/** Fetch an authenticated image as an object URL (for photos/logos). */
export async function fetchObjectUrl(path) {
  const { blob } = await fetchBlob(path);
  return URL.createObjectURL(blob);
}
