import { Compass } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState } from "../components/ui";

export function NotFoundPage({ home = "/" }) {
  return (
    <div className="container" style={{ padding: "64px 16px" }}>
      <EmptyState
        icon={Compass}
        title="Page not found"
        action={
          <Link to={home} className="btn btn--dark">
            Go to the start page
          </Link>
        }
      >
        The page you're looking for doesn't exist or has moved.
      </EmptyState>
    </div>
  );
}
