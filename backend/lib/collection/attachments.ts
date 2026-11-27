export type AttachmentKind = "PDF" | "XLSX" | "XLS" | "CSV";

const allowed: Record<AttachmentKind, string[]> = {
  PDF: ["application/pdf"],
  XLSX: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  XLS: ["application/vnd.ms-excel", "application/octet-stream"],
  CSV: ["text/csv", "application/csv", "text/plain"],
};

export function detectAttachmentKind(fileName: string, contentType: string | null): AttachmentKind | null {
  const lowerName = fileName.toLowerCase();
  const match = lowerName.match(/\.(pdf|xlsx|xls|csv)$/)?.[1];
  if (!match) return null;
  const kind = match.toUpperCase() as AttachmentKind;
  if (!contentType || allowed[kind].includes(contentType.split(";")[0].trim().toLowerCase())) return kind;
  return null;
}

export function validateAttachment(fileName: string, contentType: string | null, sizeBytes: number, maxBytes = 20_000_000) {
  const kind = detectAttachmentKind(fileName, contentType);
  return { valid: Boolean(kind) && sizeBytes <= maxBytes, kind, reason: !kind ? "文件扩展名与Content-Type不匹配或不在白名单" : sizeBytes > maxBytes ? "文件超过大小限制" : null };
}
