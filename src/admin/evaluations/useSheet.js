import { useEffect, useRef, useState } from "react";
import { exportElementToPdf } from "../../lib/pdf";
import { useToast } from "../../lib/toast-context";

/** Shared state for evaluation sheets: dirty tracking, unload guard, PDF export. */
export function useSheet(initial) {
  const [values, setValues] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const sheetRef = useRef(null);
  const toast = useToast();

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = (patch) => {
    setValues((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  };

  const updateIn = (group, key, value) => {
    setValues((prev) => ({ ...prev, [group]: { ...prev[group], [key]: value } }));
    setDirty(true);
  };

  const exportPdf = async (filename, landscape = false) => {
    setPdfBusy(true);
    try {
      await exportElementToPdf(sheetRef.current, filename, { landscape });
    } catch {
      toast.error("The PDF couldn't be created. Use Print and choose “Save as PDF” instead.");
    } finally {
      setPdfBusy(false);
    }
  };

  return { values, setValues, update, updateIn, dirty, setDirty, saving, setSaving, pdfBusy, exportPdf, sheetRef, toast };
}

/** Panel members usually evaluate several startups; prefill their name. */
export function rememberedEvaluator() {
  try {
    return localStorage.getItem("aic.evaluatorName") || "";
  } catch {
    return "";
  }
}
