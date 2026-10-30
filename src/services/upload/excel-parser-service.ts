import type { ParseResult } from '@/domain/upload/types';

interface ParseProgress {
    progress: number;
    message: string;
}

interface ParseOptions {
    file: File;
    requiredColumns: string[];
    onProgress?: (progress: ParseProgress) => void;
}

interface WorkerSuccessMessage {
    type: 'success';
    headers: string[];
    rows: Record<string, unknown>[];
    totalRows: number;
    validRows: number;
    invalidRows: number;
    missingColumns: string[];
}

interface WorkerProgressMessage {
    type: 'progress';
    progress: number;
    message: string;
}

interface WorkerErrorMessage {
    type: 'error';
    message: string;
}

interface WorkerCancelledMessage {
    type: 'cancelled';
    message: string;
}

type WorkerResponse =
    | WorkerSuccessMessage
    | WorkerProgressMessage
    | WorkerErrorMessage
    | WorkerCancelledMessage;

export interface ExcelParseResult extends ParseResult {
    validRows: number;
    invalidRows: number;
    missingColumns: string[];
}

export function createExcelParser() {
    let worker: Worker | null = null;

    async function parse({
                             file,
                             requiredColumns,
                             onProgress,
                         }: ParseOptions): Promise<ExcelParseResult> {
        worker?.terminate();

        worker = new Worker(
            new URL(
                '../../workers/excel-parser.worker.ts',
                import.meta.url,
            ),
        );

        const buffer = await file.arrayBuffer();

        return new Promise((resolve, reject) => {
            if (!worker) {
                reject(new Error('Worker ساخته نشد.'));
                return;
            }

            worker.onmessage = (
                event: MessageEvent<WorkerResponse>,
            ) => {
                const message = event.data;

                if (message.type === 'progress') {
                    onProgress?.({
                        progress: message.progress,
                        message: message.message,
                    });

                    return;
                }

                if (message.type === 'success') {
                    worker?.terminate();
                    worker = null;

                    resolve({
                        headers: message.headers,
                        rows: message.rows,
                        totalRows: message.totalRows,
                        validRows: message.validRows,
                        invalidRows: message.invalidRows,
                        missingColumns: message.missingColumns,
                    });

                    return;
                }

                if (message.type === 'cancelled') {
                    worker?.terminate();
                    worker = null;

                    reject(new Error(message.message));
                    return;
                }

                if (message.type === 'error') {
                    worker?.terminate();
                    worker = null;

                    reject(new Error(message.message));
                }
            };

            worker.onerror = () => {
                worker?.terminate();
                worker = null;

                reject(
                    new Error('ارتباط با پردازشگر فایل قطع شد.'),
                );
            };

            worker.postMessage(
                {
                    type: 'parse',
                    buffer,
                    requiredColumns,
                },
                [buffer],
            );
        });
    }

    function cancel() {
        worker?.postMessage({
            type: 'cancel',
        });
    }

    function terminate() {
        worker?.terminate();
        worker = null;
    }

    return {
        parse,
        cancel,
        terminate,
    };
}
