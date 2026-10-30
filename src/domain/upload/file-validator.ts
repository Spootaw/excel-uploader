import type {
    SelectedFile,
    UploadConfig,
    UploadError,
} from './types';

import {
    createFileId,
    isExcelFile,
} from './file-utils';

export function validateFile(
    file: File,
    config: UploadConfig,
): SelectedFile {
    const errors: UploadError[] = [];

    if (!isExcelFile(file, config.acceptedExtensions)) {
        errors.push({
            code: 'INVALID_EXTENSION',
            message: 'فرمت فایل باید xlsx یا xls باشد.',
        });
    }

    if (file.size > config.maxFileSizeInBytes) {
        errors.push({
            code: 'FILE_TOO_LARGE',
            message: `حجم فایل نباید بیشتر از ${Math.round(
                config.maxFileSizeInBytes / 1024 / 1024,
            )} مگابایت باشد.`,
        });
    }

    return {
        id: createFileId(file),
        file,
        name: file.name,
        size: file.size,
        status: errors.length > 0 ? 'invalid' : 'ready',
        progress: 0,
        errors,
    };
}
