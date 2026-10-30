import * as XLSX from 'xlsx';

interface ParseRequest {
    type: 'parse';
    buffer: ArrayBuffer;
    requiredColumns: string[];
}

interface CancelRequest {
    type: 'cancel';
}

type WorkerRequest = ParseRequest | CancelRequest;

interface ParseProgressMessage {
    type: 'progress';
    progress: number;
    message: string;
}

interface ParseSuccessMessage {
    type: 'success';
    headers: string[];
    rows: Record<string, unknown>[];
    totalRows: number;
    validRows: number;
    invalidRows: number;
    missingColumns: string[];
}

interface ParseErrorMessage {
    type: 'error';
    message: string;
}

interface ParseCancelledMessage {
    type: 'cancelled';
    message: string;
}

type WorkerResponse =
    | ParseProgressMessage
    | ParseSuccessMessage
    | ParseErrorMessage
    | ParseCancelledMessage;

let isCancelled = false;

function postMessageToMain(message: WorkerResponse) {
    self.postMessage(message);
}

function normalizeHeader(value: unknown): string {
    return String(value ?? '')
        .trim()
        .toLowerCase();
}

function parseExcelFile({
                            buffer,
                            requiredColumns,
                        }: ParseRequest) {
    isCancelled = false;

    postMessageToMain({
        type: 'progress',
        progress: 5,
        message: 'در حال خواندن فایل Excel...',
    });

    const workbook = XLSX.read(buffer, {
        type: 'array',
        cellDates: true,
        cellNF: false,
        cellText: false,
    });

    if (isCancelled) {
        postMessageToMain({
            type: 'cancelled',
            message: 'پردازش فایل لغو شد.',
        });

        return;
    }

    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
        throw new Error('فایل Excel فاقد Sheet است.');
    }

    const worksheet = workbook.Sheets[firstSheetName];

    const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
        header: 1,
        defval: '',
        raw: true,
    });

    if (matrix.length === 0) {
        throw new Error('فایل Excel خالی است.');
    }

    postMessageToMain({
        type: 'progress',
        progress: 25,
        message: 'Headerهای فایل در حال بررسی هستند...',
    });

    const rawHeaders = matrix[0] ?? [];

    const headers = rawHeaders.map((header) =>
        String(header ?? '').trim(),
    );

    const normalizedHeaders = new Set(
        headers
            .filter(Boolean)
            .map(normalizeHeader),
    );

    const missingColumns = requiredColumns.filter(
        (column) => !normalizedHeaders.has(normalizeHeader(column)),
    );

    const dataRows = matrix.slice(1);
    const totalRows = dataRows.length;

    const rows: Record<string, unknown>[] = [];
    let invalidRows = 0;

    for (let index = 0; index < dataRows.length; index += 1) {
        if (isCancelled) {
            postMessageToMain({
                type: 'cancelled',
                message: 'پردازش فایل لغو شد.',
            });

            return;
        }

        const sourceRow = dataRows[index] ?? [];
        const row: Record<string, unknown> = {};

        headers.forEach((header, columnIndex) => {
            if (!header) {
                return;
            }

            row[header] = sourceRow[columnIndex] ?? '';
        });

        const hasEmptyRequiredValue = requiredColumns.some(
            (requiredColumn) => {
                const actualHeader = headers.find(
                    (header) =>
                        normalizeHeader(header) ===
                        normalizeHeader(requiredColumn),
                );

                if (!actualHeader) {
                    return true;
                }

                const value = row[actualHeader];

                return (
                    value === undefined ||
                    value === null ||
                    String(value).trim() === ''
                );
            },
        );

        if (hasEmptyRequiredValue) {
            invalidRows += 1;
        }

        rows.push(row);

        if (index % 1000 === 0 || index === dataRows.length - 1) {
            const rowProgress =
                totalRows === 0
                    ? 0
                    : Math.round(((index + 1) / totalRows) * 70);

            postMessageToMain({
                type: 'progress',
                progress: 25 + rowProgress,
                message: `پردازش ردیف ${index + 1} از ${totalRows}`,
            });
        }
    }

    postMessageToMain({
        type: 'progress',
        progress: 100,
        message: 'پردازش فایل به پایان رسید.',
    });

    postMessageToMain({
        type: 'success',
        headers,
        rows,
        totalRows,
        validRows: totalRows - invalidRows,
        invalidRows,
        missingColumns,
    });
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
    try {
        const message = event.data;

        if (message.type === 'cancel') {
            isCancelled = true;
            return;
        }

        if (message.type === 'parse') {
            parseExcelFile(message);
        }
    } catch (error) {
        postMessageToMain({
            type: 'error',
            message:
                error instanceof Error
                    ? error.message
                    : 'خطایی هنگام پردازش فایل رخ داد.',
        });
    }
};

export {};
