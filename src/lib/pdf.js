/**
 * Render a DOM element to a multi-page A4 PDF. The PDF libraries are loaded
 * on demand so they don't weigh down the initial bundle.
 */
export async function exportElementToPdf(element, filename, { landscape = false } = {}) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    ignoreElements: (el) => el.classList?.contains("no-print"),
    onclone: (doc) => {
      // Reveal print-only headers (logos) in the PDF, as in a real print.
      doc.documentElement.classList.add("pdf-export");
      // html2canvas renders attribute values, not live form state.
      doc.querySelectorAll("input").forEach((input) => {
        if (input.type === "checkbox" || input.type === "radio") {
          if (input.checked) input.setAttribute("checked", "checked");
        } else {
          input.setAttribute("value", input.value);
        }
      });
      doc.querySelectorAll("textarea").forEach((textarea) => {
        textarea.textContent = textarea.value;
      });
      doc.querySelectorAll("select").forEach((select) => {
        Array.from(select.options).forEach((option) => {
          if (option.selected) option.setAttribute("selected", "selected");
        });
      });
    },
  });

  const pdf = new jsPDF({ orientation: landscape ? "l" : "p", unit: "mm", format: "a4", compress: true });
  const margin = 10;
  const pageWidth = pdf.internal.pageSize.getWidth() - margin * 2;
  const pageHeight = pdf.internal.pageSize.getHeight() - margin * 2;
  const pxPerMm = canvas.width / pageWidth;
  const sliceHeightPx = Math.floor(pageHeight * pxPerMm);

  // Slice the tall canvas into page-sized pieces instead of re-drawing the
  // whole image offset on every page.
  for (let y = 0, page = 0; y < canvas.height; y += sliceHeightPx, page += 1) {
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = Math.min(sliceHeightPx, canvas.height - y);
    slice.getContext("2d").drawImage(canvas, 0, y, canvas.width, slice.height, 0, 0, canvas.width, slice.height);
    if (page > 0) pdf.addPage();
    // JPEG keeps a multi-page document to a few hundred KB (PNG made it tens of MB).
    pdf.addImage(slice.toDataURL("image/jpeg", 0.85), "JPEG", margin, margin, pageWidth, slice.height / pxPerMm, undefined, "FAST");
  }

  pdf.save(filename);
}
