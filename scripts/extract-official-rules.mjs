import fs from "node:fs/promises";
import * as XLSX from "xlsx";

const input = process.argv[2];
const output = process.argv[3] ?? "data/point-rules.json";
if (!input) throw new Error("Usage: node scripts/extract-official-rules.mjs <source.xlsx> [output.json]");

const workbook = XLSX.read(await fs.readFile(input), { type: "buffer" });
const rows = (sheetName) => XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "" });
const debitRules = rows("Trừ điểm").slice(4).filter((row) => row[0]).map((row) => ({
  id: `D${String(row[0]).padStart(3, "0")}`, type: "DEBIT", points: Number(row[1]), category: String(row[2]),
  title: String(row[3]), note: String(row[4] || ""), sourcePage: Number(row[5]) || null, schoolYear: "2026–2027", active: true, sortOrder: Number(row[0]),
}));
const creditRules = rows("Cộng điểm").slice(4).filter((row) => row[0]).map((row) => ({
  id: `C${String(row[0]).padStart(3, "0")}`, type: "CREDIT", points: Number(row[1]), category: String(row[2]),
  title: String(row[3]), note: String(row[4] || ""), sourcePage: Number(row[5]) || null, schoolYear: "2026–2027", active: true, sortOrder: 100 + Number(row[0]),
}));

await fs.mkdir(new URL("../data/", import.meta.url), { recursive: true });
await fs.writeFile(output, `${JSON.stringify([...debitRules, ...creditRules], null, 2)}\n`, "utf8");
console.log(`Wrote ${debitRules.length} debit and ${creditRules.length} credit rules to ${output}`);
