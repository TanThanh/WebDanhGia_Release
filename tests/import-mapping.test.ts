import { describe, expect, it } from "vitest";
import { autoMap, collapseMergedHeaderColumns, detectClassHint, detectHeaderIndex, extractClassHint, normalizeText, parseDateInput } from "../src/lib/normalization";

describe("flexible student import", () => {
  it("detects a header after title rows and maps Vietnamese aliases", () => {
    const rows = [["DANH SÁCH LỚP 9/15"], ["Năm học 2026-2027"], ["Số thứ tự", "Tên học sinh", "Lớp học", "SĐT"]];
    const index = detectHeaderIndex(rows);
    expect(index).toBe(2);
    expect(autoMap(rows[index])).toMatchObject({ ordinal: 0, fullName: 1, className: 2, phone: 3, note: -1 });
  });

  it("normalizes accents and parses dd/mm/yyyy", () => {
    expect(normalizeText("  Nguyễn   Đình  ")).toBe("nguyen dinh");
    expect(parseDateInput("02/09/2012")?.toISOString().slice(0, 10)).toBe("2012-09-02");
  });

  it("joins name parts below a merged Họ và tên header", () => {
    const rows = [["STT", "Họ và tên", "", "Ngày sinh"], ["1", "Nguyễn Thiên", "Ân", "29/03/2012"]];
    expect(collapseMergedHeaderColumns(rows, 0, [{ s: { r: 0, c: 1 }, e: { r: 0, c: 2 } }])).toEqual([
      ["STT", "Họ và tên", "Ngày sinh"], ["1", "Nguyễn Thiên Ân", "29/03/2012"],
    ]);
  });

  it("detects current class from a title block and common filename spelling", () => {
    expect(detectClassHint([["DANH SÁCH"], ["Lớp :", "", "9/15"]], 3)).toBe("9/15");
    expect(extractClassHint("danh sach 9a15.xlsx")).toBe("9/15");
    expect(extractClassHint("Năm học 2026-2027")).toBe("");
  });
});
