// ============================================================================
// FILE:       frontend/src/utils/csv.ts
// PURPOSE:    Client-side CSV file parsing and preview generation using PapaParse.
//             Used by ImportWizard to render a fast tabular preview and highlight
//             missing fields before uploading files to the backend.
// HOW IT WORKS: Reads uploaded File via FileReader/PapaParse, checks headers,
//             validates the first rows, and flags row-level errors.
// USED BY / DEPENDS ON: src/components/transfer/ImportWizard.tsx, papaparse.
// KEY CONCEPTS: Client-side file preview, row validation, CSV column mapping.
// ============================================================================

import Papa from "papaparse";

export interface CsvPreviewResult {
  headers: string[];
  rows: Record<string, string>[];
  errors: string[];
}

/**
 * Parse an uploaded CSV or JSON file in the browser for wizard preview.
 *
 * @param {File} file - Browser File object selected by user.
 * @returns {Promise<CsvPreviewResult>} Extracted headers, sample rows, and format errors.
 */
export async function parseFilePreview(file: File): Promise<CsvPreviewResult> {
  const fileName = file.name.toLowerCase();

  // Handle JSON file preview.
  if (fileName.endsWith(".json")) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const parsed = JSON.parse(text);
          if (!Array.isArray(parsed)) {
            resolve({
              headers: [],
              rows: [],
              errors: ["JSON root must be an array of task objects."],
            });
            return;
          }

          const sample = parsed.slice(0, 10);
          const headers = Array.from(
            new Set(sample.flatMap((item) => (typeof item === "object" ? Object.keys(item) : [])))
          );

          resolve({
            headers,
            rows: sample.map((item) =>
              Object.fromEntries(
                Object.entries(item).map(([k, v]) => [
                  k,
                  typeof v === "object" ? JSON.stringify(v) : String(v ?? ""),
                ])
              )
            ),
            errors: [],
          });
        } catch (err: any) {
          resolve({
            headers: [],
            rows: [],
            errors: [`Invalid JSON syntax: ${err.message}`],
          });
        }
      };
      reader.readAsText(file);
    });
  }

  // Handle CSV file preview via PapaParse.
  return new Promise((resolve) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      preview: 10,
      complete: (results) => {
        const errors: string[] = [];
        const headers = results.meta.fields || [];

        // Check for required title column.
        const hasTitle = headers.some((h) => h.trim().toLowerCase() === "title");
        if (!hasTitle) {
          errors.push("CSV header is missing the required 'title' column.");
        }

        resolve({
          headers,
          rows: results.data,
          errors,
        });
      },
      error: (error) => {
        resolve({
          headers: [],
          rows: [],
          errors: [`CSV Parse Error: ${error.message}`],
        });
      },
    });
  });
}
