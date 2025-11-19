import { parse } from "csv-parse/sync";
import { enqueueUrl } from "../repositories/queueRepository";
import {
  NormalizedUrlRow,
  upsertUrls,
} from "../repositories/urlRepository";

interface UploadPayload {
  csvContent: string;
  fileName?: string;
}

function normalizeCsv(csvContent: string): NormalizedUrlRow[] {
  let csvText = Buffer.from(csvContent, "base64").toString("utf-8");
  if (csvText.charCodeAt(0) === 0xfeff) {
    csvText = csvText.slice(1);
  }

  const records: any[] = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  if (records.length === 0) {
    throw new Error("CSV file is empty or contains no data rows");
  }

  const columns = Object.keys(records[0] || {});

  const normalized = records
    .map((row) => {
      const findKey = (target: string) =>
        Object.keys(row).find(
          (key) => key.toLowerCase().trim() === target
        );
      const typeKey = findKey("type");
      const urlKey = findKey("url");
      const idKey = findKey("id");

      const type = typeKey ? (row[typeKey] || "").toString().trim() : "";
      const url = urlKey ? (row[urlKey] || "").toString().trim() : "";
      const id = idKey ? (row[idKey] || "").toString().trim() : "";

      return { type, url, id };
    })
    .filter((row) => row.type && row.url);

  if (normalized.length === 0) {
    throw new Error(
      `No valid rows found in CSV. Found columns: ${columns.join(
        ", "
      )}. Required: type, url (case-insensitive). Optional: id`
    );
  }

  return normalized;
}

export async function processUpload(payload: UploadPayload) {
  if (!payload.csvContent) {
    throw new Error("csvContent is required");
  }

  const normalizedRows = normalizeCsv(payload.csvContent);
  await upsertUrls(normalizedRows);

  await Promise.all(
    normalizedRows.map((row) =>
      enqueueUrl({
        url: row.url,
        type: row.type,
        ...(row.id && { id: row.id }),
      })
    )
  );

  return {
    urlCount: normalizedRows.length,
    fileName: payload.fileName || "upload.csv",
  };
}

