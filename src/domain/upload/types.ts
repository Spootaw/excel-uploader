export type FileStatus =
    | 'selected'
    | 'validating'
    | 'invalid'
    | 'ready'
    | 'parsing'
    | 'parsed'
    | 'uploading'
    | 'uploaded'
    | 'failed'
    | 'cancelled';

export type PipelineStage =
    | 'selection'
    | 'file-validation'
    | 'parsing'
    | 'data-validation'
    | 'upload';

export type UploadErrorCode =
    | 'INVALID_EXTENSION'
    | 'FILE_TOO_LARGE'
    | 'TOO_MANY_FILES'
    | 'MISSING_REQUIRED_COLUMN'
    | 'INVALID_CELL_VALUE'
    | 'PARSING_ERROR'
    | 'UPLOAD_ERROR'
    | 'CANCELLED'
    | 'UNKNOWN';

export interface UploadError {
    code: UploadErrorCode;
    message: string;
    rowNumber?: number;
    columnName?: string;
}

export interface SelectedFile {
    id: string;
    file: File;
    name: string;
    size: number;
    status: FileStatus;
    progress: number;
    errors: UploadError[];
    totalRows?: number;
    validRows?: number;
    invalidRows?: number;
}

export interface UploadConfig {
    maxFiles: number;
    maxFileSizeInBytes: number;
    acceptedExtensions: string[];
    requiredColumns: string[];
}

export interface ParsedRow {
    [columnName: string]: unknown;
}

export interface ParseResult {
    headers: string[];
    rows: ParsedRow[];
    totalRows: number;
}

export interface ProcessingProgress {
    stage: PipelineStage;
    progress: number;
    processedRows?: number;
    totalRows?: number;
    message?: string;
}
