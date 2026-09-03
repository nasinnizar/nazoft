import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function loadFormats() {
  const source = await readFile(new URL("../scripts/report-files.js", import.meta.url), "utf8");
  const context = {
    Array, Date, Math, Number, Object, Set, String, TextEncoder,
    Uint8Array, Uint32Array, atob
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(`${source}\nglobalThis.formats = NazoftFileFormats;`, context);
  return context.formats;
}

const sheets = [{
  name: "Leads",
  rows: [
    { kind: "title", cells: ["Nazoft CRM"] },
    { kind: "header", cells: ["Lead", "Value"] },
    { kind: "data", cells: ["Test Client", 2500] }
  ]
}];

test("Excel export is a genuine XLSX workbook", async () => {
  const formats = await loadFormats();
  const workbook = formats.createXlsxWorkbook(sheets);
  assert.deepEqual([...workbook.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
  assert.ok(workbook.length > 5000);
});

test("PDF export creates a valid report document", async () => {
  const formats = await loadFormats();
  const pdf = formats.createPdfReport(sheets, "All Leads Report");
  assert.equal(new TextDecoder().decode(pdf.slice(0, 8)), "%PDF-1.4");
  assert.ok(pdf.length > 900);
});
