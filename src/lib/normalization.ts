export function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export type ImportField = "ordinal" | "fullName" | "dateOfBirth" | "gender" | "className" | "phone" | "note";
export type ImportMapping = Record<ImportField, number>;

export const fieldAliases: Record<ImportField, string[]> = {
  ordinal: ["stt", "so thu tu", "số thứ tự"],
  fullName: ["ho va ten", "họ và tên", "ho ten", "họ tên", "ten hoc sinh", "tên học sinh", "student name", "name"],
  dateOfBirth: ["ngay sinh", "ngày sinh", "date of birth", "dob"],
  gender: ["gioi tinh", "giới tính", "gt", "gender"],
  className: ["lop", "lớp", "lop hoc", "lớp học", "class"],
  phone: ["so dt", "số đt", "sdt", "sđt", "dien thoai", "điện thoại", "so dien thoai", "số điện thoại", "phone"],
  note: ["ghi chu", "ghi chú", "note", "notes"],
};

export function scoreHeader(row: unknown[]): number {
  const aliases = Object.values(fieldAliases).flat().map(normalizeText);
  return row.reduce<number>((sum, cell) => sum + (aliases.includes(normalizeText(cell)) ? 1 : 0), 0);
}

export function detectHeaderIndex(rows: unknown[][], scanLimit = 15): number {
  let bestIndex = 0;
  let bestScore = -1;
  rows.slice(0, scanLimit).forEach((row, index) => {
    const score = scoreHeader(row);
    if (score > bestScore) {
      bestIndex = index;
      bestScore = score;
    }
  });
  return bestIndex;
}

export function autoMap(headers: unknown[]): ImportMapping {
  return Object.fromEntries(
    Object.entries(fieldAliases).map(([field, aliases]) => [
      field,
      headers.findIndex((header) => aliases.map(normalizeText).includes(normalizeText(header))),
    ]),
  ) as ImportMapping;
}

export type SheetMerge = { s: { r: number; c: number }; e: { r: number; c: number } };

export function collapseMergedHeaderColumns(rows: unknown[][], headerIndex: number, merges: SheetMerge[]) {
  const headerMerges = merges.filter((merge) => merge.s.r === headerIndex && merge.e.r === headerIndex && merge.e.c > merge.s.c);
  const continuationColumns = new Set(headerMerges.flatMap((merge) => Array.from({ length: merge.e.c - merge.s.c }, (_, index) => merge.s.c + index + 1)));
  const mergeByStart = new Map(headerMerges.map((merge) => [merge.s.c, merge]));
  const width = Math.max(...rows.map((row) => row.length), 0);
  const keptColumns = Array.from({ length: width }, (_, index) => index).filter((index) => !continuationColumns.has(index));
  return rows.map((row, rowIndex) => keptColumns.map((column) => {
    const merge = mergeByStart.get(column);
    if (!merge || rowIndex <= headerIndex) return row[column] ?? "";
    return Array.from({ length: merge.e.c - merge.s.c + 1 }, (_, offset) => String(row[merge.s.c + offset] ?? "").trim()).filter(Boolean).join(" ");
  }));
}

export function extractClassHint(value: unknown): string {
  const text = String(value ?? "");
  const match = text.match(/(?<!\d)(?:lớp|lop)?\s*:?\s*(\d{1,2})\s*[\/aA._-]\s*(\d{1,2})(?!\d)/i);
  return match ? `${Number(match[1])}/${Number(match[2])}` : "";
}

export function detectClassHint(rows: unknown[][], headerIndex: number): string {
  return extractClassHint(rows.slice(0, headerIndex).flat().join(" "));
}

export function parseDateInput(value: string): Date | null {
  const text = value.trim();
  if (!text) return null;
  const vietnamese = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (vietnamese) {
    const date = new Date(Date.UTC(Number(vietnamese[3]), Number(vietnamese[2]) - 1, Number(vietnamese[1])));
    return Number.isNaN(date.valueOf()) ? null : date;
  }
  const date = new Date(text);
  return Number.isNaN(date.valueOf()) ? null : date;
}
