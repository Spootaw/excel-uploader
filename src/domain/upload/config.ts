import type { UploadConfig } from './types';

export const defaultUploadConfig: UploadConfig = {
    maxFiles: 3,
    maxFileSizeInBytes: 20 * 1024 * 1024,
    acceptedExtensions: ['xlsx', 'xls'],
    requiredColumns: ['orderId', 'recipientName', 'phoneNumber'],
};
