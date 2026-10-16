// Byte-order mark so Excel detects UTF-8.
const BOM = String.fromCharCode(0xfeff);
const CRLF = String.fromCharCode(13, 10);

function cell(value) {
  let text = value === null || value === undefined ? "" : String(value);
  // Neutralise spreadsheet formula injection from applicant-supplied text.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** Build CSV text (UTF-8 with BOM, CRLF line endings) that opens cleanly in Excel. */
export function toCsv(columns, rows) {
  const lines = [columns.map((c) => cell(c.label)).join(",")];
  rows.forEach((row) => lines.push(columns.map((c) => cell(c.value ? c.value(row) : row[c.key])).join(",")));
  return BOM + lines.join(CRLF);
}

export function downloadCsv(filename, columns, rows) {
  const blob = new Blob([toCsv(columns, rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
