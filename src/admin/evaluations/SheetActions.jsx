import { Download, Printer, Save } from "lucide-react";
import { Button } from "../../components/ui";

/** Sticky action bar shared by the evaluation sheets. */
export function SheetActions({ isNew, dirty, saving, onSave, onPrint, onPdf, pdfBusy, saveLabel = "Save evaluation" }) {
  return (
    <div className="sheet-actions no-print">
      <span className="sheet-actions__status" aria-live="polite">
        {saving ? "Saving…" : dirty ? "Unsaved changes" : isNew ? "Not saved yet" : "All changes saved"}
      </span>
      <div className="row row--wrap">
        <Button icon={Printer} onClick={onPrint}>
          Print
        </Button>
        <Button icon={Download} onClick={onPdf} loading={pdfBusy}>
          PDF
        </Button>
        {onSave && (
          <Button variant="primary" icon={Save} onClick={onSave} loading={saving}>
            {saveLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
