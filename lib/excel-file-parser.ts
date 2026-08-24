import { strFromU8, unzipSync } from "fflate";
import type { ExcelImportInputRow } from "./excel-import";

function parseCsvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(cell);
      cell = "";
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}
function columnIndex(reference: string) {
  const letters = reference.match(/^[A-Z]+/)?.[0] ?? "A";
  let result = 0;
  for (const char of letters) result = result * 26 + char.charCodeAt(0) - 64;
  return result - 1;
}

function xmlDocument(bytes: Uint8Array | undefined, label: string) {
  if (!bytes) throw new Error(`Excel文件缺少${label}`);
  const document = new DOMParser().parseFromString(strFromU8(bytes), "application/xml");
  if (document.querySelector("parsererror")) throw new Error(`Excel文件中的${label}无法解析`);
  return document;
}

function sharedStringValues(bytes: Uint8Array | undefined) {
  if (!bytes) return [] as string[];
  const document = xmlDocument(bytes, "共享文本表");
  return Array.from(document.getElementsByTagName("si")).map((item) => Array.from(item.getElementsByTagName("t")).map((node) => node.textContent ?? "").join(""));
}

function worksheetRows(archive: Record<string, Uint8Array>) {
  const sheetPath = Object.keys(archive).filter((key) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(key)).sort()[0];
  if (!sheetPath) throw new Error("Excel文件中没有可读取的工作表");
  const shared = sharedStringValues(archive["xl/sharedStrings.xml"]);
  const document = xmlDocument(archive[sheetPath], "工作表");
  return Array.from(document.getElementsByTagName("row")).map((rowNode) => {
    const values: string[] = [];
    for (const cellNode of Array.from(rowNode.getElementsByTagName("c"))) {
      const index = columnIndex(cellNode.getAttribute("r") ?? "A1");
      const type = cellNode.getAttribute("t");
      const raw = cellNode.getElementsByTagName("v")[0]?.textContent ?? "";
      const inline = Array.from(cellNode.getElementsByTagName("t")).map((node) => node.textContent ?? "").join("");
      values[index] = type === "s" ? shared[Number(raw)] ?? "" : type === "inlineStr" ? inline : type === "b" ? (raw === "1" ? "是" : "否") : raw;
    }
    return values;
  }).filter((row) => row.some((value) => String(value ?? "").trim()));
}

function rowsToRecords(rows: string[][]) {
  const headerIndex = rows.findIndex((row) => row.filter((value) => String(value ?? "").trim()).length >= 2);
  if (headerIndex < 0) throw new Error("文件中没有识别到表头");
  const headers = rows[headerIndex].map((value, index) => String(value ?? "").replace(/^\ufeff/, "").trim() || `未命名字段${index + 1}`);
  const uniqueHeaders = headers.map((header, index) => headers.indexOf(header) === index ? header : `${header}_${index + 1}`);
  const records = rows.slice(headerIndex + 1).filter((row) => {
    const nonEmpty = row.map((value) => String(value ?? "").trim()).filter(Boolean);
    if (!nonEmpty.length) return false;
    return !(nonEmpty.length === 1 && /^(说明|注释|备注说明)\s*[：:]/.test(nonEmpty[0]));
  }).map((row) => Object.fromEntries(uniqueHeaders.map((header, index) => {
    const raw = String(row[index] ?? "").trim();
    if (/时间|日期/.test(header) && /^\d{5}(?:\.\d+)?$/.test(raw)) {
      const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(raw)) * 86_400_000);
      return [header, date.toISOString().slice(0, 10)];
    }
    return [header, raw];
  })) as ExcelImportInputRow);
  if (!records.length) throw new Error("表头下方没有可导入的数据");
  if (records.length > 5000) throw new Error("单次最多导入5000行，请拆分文件后重试");
  return { headers: uniqueHeaders, rows: records };
}

export async function parseExcelUpload(file: File) {
  const extension = file.name.toLowerCase().split(".").pop();
  if (extension === "csv") {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let text = new TextDecoder("utf-8").decode(bytes);
    if (text.includes("�")) text = new TextDecoder("gb18030").decode(bytes);
    return rowsToRecords(parseCsvRows(text));
  }
  if (extension === "xls") throw new Error("旧版 .xls 暂不支持，请在Excel中另存为 .xlsx 后上传");
  if (extension !== "xlsx") throw new Error("请选择 .xlsx 或 .csv 文件");
  const archive = unzipSync(new Uint8Array(await file.arrayBuffer()));
  return rowsToRecords(worksheetRows(archive));
}
