import * as XLSX from "xlsx";

/**
 * Export an array of plain objects to an .xlsx file and trigger a download.
 * Keys of the first row become the header; pass already-formatted/labeled
 * objects (Bahasa Indonesia headers) so the sheet is human-readable.
 */
export function exportToExcel(
  rows: Record<string, string | number | null | undefined>[],
  opts: { fileName: string; sheetName?: string }
) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, opts.sheetName ?? "Data");

  // Auto-width kolom berdasarkan isi terpanjang (dibatasi biar tak kelewat lebar).
  const keys = rows.length ? Object.keys(rows[0]) : [];
  ws["!cols"] = keys.map((k) => {
    const maxLen = rows.reduce((m, r) => {
      const v = r[k];
      return Math.max(m, v == null ? 0 : String(v).length);
    }, k.length);
    return { wch: Math.min(Math.max(maxLen + 2, 8), 50) };
  });

  XLSX.writeFile(wb, opts.fileName);
}

/** Stempel tanggal untuk nama file, mis. 2026-06-24. */
export function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}
