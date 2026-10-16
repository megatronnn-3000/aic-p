import { Download, Eye, FileImage, FileText, Trash2 } from "lucide-react";
import { useState } from "react";
import { downloadFile, openFile } from "../lib/api";
import { formatBytes } from "../lib/format";
import { useToast } from "../lib/toast-context";
import { ConfirmDialog } from "./Dialog";
import { Button } from "./ui";

const PREVIEWABLE = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);

/** Stored documents with preview / download / optional delete. */
export function FileList({ files, labels = {}, onDelete }) {
  const toast = useToast();
  const [busyId, setBusyId] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const run = async (file, action) => {
    setBusyId(file.id);
    try {
      await action();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <ul className="file-list">
        {files.map((file) => {
          const Icon = file.content_type?.startsWith("image/") ? FileImage : FileText;
          return (
            <li key={file.id}>
              <span className="file-list__icon" aria-hidden="true">
                <Icon />
              </span>
              <span className="file-list__text">
                <span className="file-list__label">{labels[file.field] || file.field}</span>
                <span className="file-list__name" title={file.original_name}>
                  {file.original_name}
                </span>
              </span>
              <span className="muted nowrap" style={{ fontSize: 12 }}>
                {formatBytes(file.size)}
              </span>
              {PREVIEWABLE.has(file.content_type) && (
                <Button
                  size="sm"
                  variant="ghost"
                  iconOnly
                  icon={Eye}
                  disabled={busyId === file.id}
                  onClick={() => run(file, () => openFile(`/api/admin/files/${file.id}`))}
                >
                  Open {file.original_name}
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                iconOnly
                icon={Download}
                loading={busyId === file.id}
                onClick={() => run(file, () => downloadFile(`/api/admin/files/${file.id}`, file.original_name))}
              >
                Download {file.original_name}
              </Button>
              {onDelete && (
                <Button size="sm" variant="danger-ghost" iconOnly icon={Trash2} onClick={() => setDeleting(file)}>
                  Delete {file.original_name}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {onDelete && (
        <ConfirmDialog
          open={Boolean(deleting)}
          onClose={() => setDeleting(null)}
          title="Delete this document?"
          description={deleting ? `${deleting.original_name} will be permanently removed.` : ""}
          confirmLabel="Delete document"
          tone="danger"
          onConfirm={async () => {
            try {
              await onDelete(deleting);
            } catch (error) {
              toast.error(error.message);
              throw error;
            }
          }}
        />
      )}
    </>
  );
}
