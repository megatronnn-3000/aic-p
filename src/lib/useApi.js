import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

/**
 * Load JSON from the API. Returns { data, error, loading, reload, setData }.
 * Data from a previous load of the same path stays visible while reloading.
 */
export function useApi(path) {
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState({ path: null, version: -1, data: undefined, error: null });

  useEffect(() => {
    if (!path) return undefined;
    const controller = new AbortController();
    api(path, { signal: controller.signal })
      .then((data) => setResult({ path, version, data, error: null }))
      .catch((error) => {
        if (error.name !== "AbortError") setResult((prev) => ({ path, version, data: prev.path === path ? prev.data : undefined, error }));
      });
    return () => controller.abort();
  }, [path, version]);

  const samePath = result.path === path;
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const setData = useCallback(
    (updater) =>
      setResult((prev) => ({ ...prev, data: typeof updater === "function" ? updater(prev.data) : updater })),
    [],
  );

  return {
    data: samePath ? result.data : undefined,
    error: samePath && result.version === version ? result.error : null,
    loading: Boolean(path) && (!samePath || result.version !== version),
    reload,
    setData,
  };
}
