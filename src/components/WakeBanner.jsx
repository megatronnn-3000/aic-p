import { useEffect, useState } from "react";
import { onSlowChange } from "../lib/api";

/** Explains the free-tier cold start (up to ~a minute) instead of a frozen UI. */
export function WakeBanner() {
  const [slow, setSlow] = useState(false);
  useEffect(() => onSlowChange(setSlow), []);
  if (!slow) return null;
  return (
    <div className="wake-banner" role="status">
      <span className="spinner" aria-hidden="true" />
      Connecting to the server — this can take up to a minute after a quiet period.
    </div>
  );
}
