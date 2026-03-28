import * as XLSX from "xlsx";

import { formatBucketLabel } from "@/lib/utils";
import { listIncludedStudies, listStudies } from "@/lib/server/repository";
import type { BucketName } from "@/db/schema";

function escapeCsvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export async function getBucketExportRows(bucket: BucketName) {
  const rows = await listStudies({ bucket });

  return rows.map((row) => ({
    Title: row.title,
    Year: row.year ?? "",
    DOI: row.doi ?? "",
    Bucket: formatBucketLabel(row.bucket ?? bucket),
    Population: row.population ?? "",
    "Measure(s)": row.measures ?? "",
    "Country / setting": row.countrySetting ?? "",
    "Has PDF": row.hasPdf ? "Yes" : "No",
    "Record key": row.recordKey,
  }));
}

export async function getIncludedStudyExportRows() {
  const rows = await listIncludedStudies();

  return rows.map((row) => ({
    Study: row.title,
    "Country / setting": row.countrySetting ?? "",
    Population: row.population ?? "",
    Design: row.design ?? "",
    Sample: row.sample ?? "",
    "Measure(s)": row.measures ?? "",
    "Follow-up": row.followUp ?? "",
    "Comparator / key note": row.comparatorKeyNote ?? "",
    DOI: row.doi ?? "",
    "Has PDF": row.hasPdf ? "Yes" : "No",
  }));
}

export function toCsv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) {
    return "";
  }

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) => headers.map((header) => escapeCsvCell(row[header])).join(",")),
  ];

  return `${lines.join("\n")}\n`;
}

export function toXlsxBuffer(rows: Array<Record<string, unknown>>, sheetName: string) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}
