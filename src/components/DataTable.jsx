import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "./ui";

function compare(a, b) {
  if (a === b) return 0;
  if (a === null || a === undefined || a === "") return 1;
  if (b === null || b === undefined || b === "") return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

/**
 * Sortable, paginated table. Columns: { key, header, render?, sortValue?, numeric?, className? }.
 * Rows link to `rowHref(row)` when given: the whole row is clickable and the
 * primary cell carries a real link for keyboard and screen-reader users.
 */
export function DataTable({ columns, rows, rowKey = (row) => row.id, rowHref, empty, pageSize = 25, initialSort, caption }) {
  const navigate = useNavigate();
  const [sort, setSort] = useState(initialSort || null);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.key === sort.key);
    if (!column) return rows;
    const value = column.sortValue || ((row) => row[column.key]);
    const direction = sort.dir === "desc" ? -1 : 1;
    // Empty values always sort last; ties keep the API's order (newest first).
    return [...rows].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      const emptyA = va === null || va === undefined || va === "";
      const emptyB = vb === null || vb === undefined || vb === "";
      if (emptyA || emptyB) return emptyA === emptyB ? 0 : emptyA ? 1 : -1;
      return compare(va, vb) * direction;
    });
  }, [rows, columns, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const visible = sorted.slice(current * pageSize, current * pageSize + pageSize);

  if (!rows.length) return empty || null;

  const toggleSort = (key) =>
    setSort((prev) => (prev?.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  return (
    <>
      <div className="table-wrap">
        <table className="table">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr>
              {columns.map((column) => {
                const active = sort?.key === column.key;
                const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
                return (
                  <th
                    key={column.key}
                    className={column.numeric ? "is-numeric" : undefined}
                    aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                    scope="col"
                  >
                    {column.sortable === false ? (
                      column.header
                    ) : (
                      <button type="button" className="sort-button" onClick={() => toggleSort(column.key)}>
                        {column.header}
                        <Icon aria-hidden="true" />
                      </button>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const href = rowHref?.(row);
              return (
                <tr
                  key={rowKey(row)}
                  className={href ? "is-clickable" : undefined}
                  onClick={
                    href
                      ? (event) => {
                          if (event.target.closest("a, button, input, select, label")) return;
                          navigate(href);
                        }
                      : undefined
                  }
                >
                  {columns.map((column) => (
                    <td key={column.key} className={[column.numeric && "is-numeric", column.className].filter(Boolean).join(" ") || undefined}>
                      {column.render ? column.render(row, href) : row[column.key] || <span className="muted">—</span>}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {sorted.length > pageSize && (
        <div className="table-footer">
          <span className="tabular">
            {current * pageSize + 1}–{Math.min(sorted.length, (current + 1) * pageSize)} of {sorted.length}
          </span>
          <div className="pagination">
            <Button size="sm" iconOnly icon={ChevronLeft} disabled={current === 0} onClick={() => setPage(current - 1)}>
              Previous page
            </Button>
            <span className="tabular">
              Page {current + 1} of {pageCount}
            </span>
            <Button
              size="sm"
              iconOnly
              icon={ChevronRight}
              disabled={current >= pageCount - 1}
              onClick={() => setPage(current + 1)}
            >
              Next page
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
