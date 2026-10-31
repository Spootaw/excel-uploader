export type UploadErrorCode =
  | "INVALID_EXTENSION"
  | "INVALID_FILE_CONTENT"
  | "MISSING_REQUIRED_COLUMN"
  | "INVALID_CELL_VALUE"
  | "PARSING_ERROR"
  | "HTTP_ERROR"
  | "NETWORK_ERROR"
  | "CANCELLED"
  | "UNKNOWN"
  | "SERVER_VALIDATION_ERROR";

export interface UploadError {
  code: UploadErrorCode;
  message: string;
  rowNumber?: number;
  columnName?: string;
}

export interface ParseResult {
  headers: string[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  missingColumns: string[];
  errors: UploadError[];
  errorsTruncated: boolean;
}

export type FileStatus =
  | "invalid"
  | "ready"
  | "parsing"
  | "parsed"
  | "uploading"
  | "paused"
  | "uploaded"
  | "failed";

export interface UploadSession {
  uploadId: string;
  chunkSize: number;
  uploadedParts: number[];
}

export interface SelectedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  status: FileStatus;
  progress: number;
  loadedBytes: number;
  errors: UploadError[];
  parsed?: ParseResult;
  session?: UploadSession;
  message?: string;
  savedSession?: boolean;
}

export interface UploadConfig {
  acceptedExtensions: string[];
  requiredColumns: string[];
  headerAliases: Record<string, string[]>;
  headerRowIndex: number;
  chunkSizeInBytes: number;
  maxErrorSamples: number;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

export interface UploadPayload {
  file: File;
  headers: string[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
}

export interface UploadResult {
  uploadId: string;
  message: string;
}
