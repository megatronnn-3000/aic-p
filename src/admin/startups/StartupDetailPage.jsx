import { FileText, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AicDocuments } from "../../components/AicDocuments";
import { ConfirmDialog } from "../../components/Dialog";
import { TabBar } from "../../components/TabBar";
import { Avatar, Button, Card, ErrorState, LoadingBlock, PageHeader } from "../../components/ui";
import { api } from "../../lib/api";
import { formatDate, safeUrl } from "../../lib/format";
import { FILE_LABELS, STARTUP_SECTIONS } from "../../lib/startupSchema";
import { useToast } from "../../lib/toast-context";
import { useApi } from "../../lib/useApi";
import { DocumentsCard } from "../applications/ApplicationDetailPage";
import { StageBadge } from "./StartupsPage";

function value(field, raw) {
  if (!raw) return null;
  if (field.type === "url") {
    const url = safeUrl(raw);
    return url ? (
      <a href={url} target="_blank" rel="noopener noreferrer">
        {raw}
      </a>
    ) : (
      raw
    );
  }
  if (field.type === "email") return <a href={`mailto:${raw}`}>{raw}</a>;
  if (field.type === "tel") return <a href={`tel:${raw.replace(/[^\d+]/g, "")}`}>{raw}</a>;
  return raw;
}

export function StartupDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: loaded, error, loading, reload, setData } = useApi(`/api/admin/startups/${id}`);
  // Older API versions don't send these lists; never let a missing field crash the page.
  const startup = loaded && { ...loaded, files: loaded.files || [], aic_documents: loaded.aic_documents || [] };
  const [deleting, setDeleting] = useState(false);
  const [params, setParams] = useSearchParams();

  if (error && !startup) return <ErrorState error={error} onRetry={reload} title={error.status === 404 ? "Startup not found" : undefined} />;
  if (loading && !startup) return <LoadingBlock />;

  const photo = startup.files.find((f) => f.field === "photo");
  const documents = startup.files.filter((f) => f.field !== "photo");
  const tabs = [
    { id: "details", label: "Details" },
    { id: "documents", label: "Startup's documents", count: documents.length },
    { id: "aic", label: "Issued by AIC", count: startup.aic_documents.length },
  ];
  const activeTab = tabs.some((t) => t.id === params.get("tab")) ? params.get("tab") : "details";
  const selectTab = (tabId) => setParams(tabId === "details" ? {} : { tab: tabId }, { replace: true });

  return (
    <>
      <PageHeader
        back={{ to: startup.graduated ? "/admin/incubation/graduated" : "/admin/incubation/startups", label: startup.graduated ? "Graduated startups" : "Incubated startups" }}
        title={
          <span className="row" style={{ gap: 16 }}>
            <Avatar name={startup.startup_name} fileId={photo?.id} size="lg" />
            {startup.startup_name}
          </span>
        }
        meta={
          <>
            <StageBadge stage={startup.stage} />
            {startup.startup_code && <span>ID {startup.startup_code}</span>}
            <span>Added {formatDate(startup.created_at)}</span>
            {startup.source_application_id && (
              <Link to={`/admin/incubation/applications/${startup.source_application_id}`} className="meta-link">
                <FileText aria-hidden="true" />
                Original application
              </Link>
            )}
          </>
        }
        actions={
          <>
            <Button as={Link} to={`/admin/incubation/startups/${startup.id}/edit`} variant="primary" icon={Pencil}>
              Edit
            </Button>
            <Button variant="danger-ghost" icon={Trash2} onClick={() => setDeleting(true)}>
              Delete
            </Button>
          </>
        }
      />

      <TabBar tabs={tabs} active={activeTab} onSelect={selectTab} label="Startup sections" idPrefix="startup" />
      <div className="tab-panel" role="tabpanel" id="startup-panel" aria-labelledby={`startup-tab-${activeTab}`}>
        {activeTab === "details" && (
          <div className="stack">
            {STARTUP_SECTIONS.map((section) => (
              <Card key={section.id} title={section.title}>
                <dl className="details">
                  {section.fields.map((field) => {
                    const shown = value(field, startup[field.name]);
                    const wide = field.wide && String(startup[field.name] || "").length > 60;
                    return (
                      <div key={field.name} className={wide ? "is-wide" : undefined}>
                        <dt>{field.label}</dt>
                        <dd className={shown ? undefined : "is-empty"}>{shown || "Not recorded"}</dd>
                      </div>
                    );
                  })}
                </dl>
              </Card>
            ))}
          </div>
        )}
        {activeTab === "documents" && (
          <DocumentsCard
            title="Startup's documents"
            files={documents}
            labels={FILE_LABELS}
            zipPath={`/api/admin/startups/${startup.id}/documents.zip`}
            zipName={`${startup.startup_name} documents.zip`}
            emptyText="No documents uploaded yet. Add them from Edit."
            onDelete={async (file) => {
              await api(`/api/admin/files/${file.id}`, { method: "DELETE" });
              setData((prev) => ({ ...prev, files: prev.files.filter((f) => f.id !== file.id) }));
              toast.success(`${file.original_name} deleted.`);
            }}
          />
        )}
        {activeTab === "aic" && (
          <AicDocuments
            ownerType="startup"
            ownerId={startup.id}
            documents={startup.aic_documents}
            recipient={startup.email}
            onChange={(list) => setData((prev) => ({ ...prev, aic_documents: list }))}
          />
        )}
      </div>

      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title={`Delete ${startup.startup_name}?`}
        description="The startup record and all of its documents, including those issued by AIC, are permanently deleted."
        confirmLabel="Delete permanently"
        tone="danger"
        onConfirm={async () => {
          try {
            await api(`/api/admin/startups/${startup.id}`, { method: "DELETE" });
            toast.success(`${startup.startup_name} was deleted.`);
            navigate("/admin/incubation/startups", { replace: true });
          } catch (err) {
            toast.error(err.message);
            throw err;
          }
        }}
      />
    </>
  );
}
