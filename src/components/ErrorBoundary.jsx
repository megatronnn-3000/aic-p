import { CircleAlert, RefreshCw } from "lucide-react";
import { Component } from "react";

/**
 * Catches rendering errors so one broken page shows a message instead of
 * blanking the whole app. Reset it by changing `resetKey` (e.g. the URL).
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, resetKey: props.resetKey };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  static getDerivedStateFromProps(props, state) {
    // Navigating elsewhere clears the error.
    if (props.resetKey !== state.resetKey) return { error: null, resetKey: props.resetKey };
    return null;
  }

  componentDidCatch(error, info) {
    console.error("Page crashed:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="empty" role="alert">
        <div className="empty__icon" aria-hidden="true">
          <CircleAlert />
        </div>
        <div className="empty__title">Something went wrong on this page</div>
        <div className="empty__text">
          Try reloading. If it keeps happening, the server may be running an older version than this page — restart the
          API and reload.
        </div>
        <button type="button" className="btn btn--dark" onClick={() => window.location.reload()}>
          <RefreshCw aria-hidden="true" />
          Reload page
        </button>
      </div>
    );
  }
}
