export function createFileId(file: File): string {
    return `${file.name}-${file.size}-${file.lastModified}`;
}

export function getFileExtension(fileName: string): string {
    const lastDotIndex = fileName.lastIndexOf('.');

    if (lastDotIndex === -1) {
        return '';
    }

    return fileName.slice(lastDotIndex + 1).toLowerCase();
}

export function formatFileSize(bytes: number): string {
    if (bytes === 0) {
        return '0 Bytes';
    }

    const units = ['Bytes', 'KB', 'MB', 'GB'];
    const unitIndex = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, unitIndex);

    return `${value.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
}

export function isExcelFile(
    file: File,
    acceptedExtensions: string[] = ['xlsx', 'xls'],
): boolean {
    const extension = getFileExtension(file.name);

    return acceptedExtensions
        .map((item) => item.toLowerCase().replace('.', ''))
        .includes(extension);
}
