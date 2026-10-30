'use client';

import {
    useRef,
    useState,
    type ChangeEvent,
    type DragEvent,
} from 'react';

import { defaultUploadConfig } from '@/domain/upload/config';
import { validateFile } from '@/domain/upload/file-validator';
import {
    formatFileSize,
} from '@/domain/upload/file-utils';
import type {
    SelectedFile,
    UploadError,
} from '@/domain/upload/types';

export function ExcelUploader() {
    const inputRef = useRef<HTMLInputElement>(null);

    const [files, setFiles] = useState<SelectedFile[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [selectionError, setSelectionError] = useState('');

    function openFilePicker() {
        inputRef.current?.click();
    }

    function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
        const selectedFiles = Array.from(event.target.files ?? []);

        addFiles(selectedFiles);

        // اجازه می‌دهد کاربر همان فایل را دوباره انتخاب کند.
        event.target.value = '';
    }

    function handleDragEnter(event: DragEvent<HTMLDivElement>) {
        event.preventDefault();
        event.stopPropagation();

        setIsDragging(true);
    }

    function handleDragOver(event: DragEvent<HTMLDivElement>) {
        event.preventDefault();
        event.stopPropagation();

        event.dataTransfer.dropEffect = 'copy';
        setIsDragging(true);
    }

    function handleDragLeave(event: DragEvent<HTMLDivElement>) {
        event.preventDefault();
        event.stopPropagation();

        // اگر از ناحیه‌ی اصلی خارج شده‌ایم، حالت drag را خاموش می‌کنیم.
        if (event.currentTarget === event.target) {
            setIsDragging(false);
        }
    }

    function handleDrop(event: DragEvent<HTMLDivElement>) {
        event.preventDefault();
        event.stopPropagation();

        setIsDragging(false);

        const droppedFiles = Array.from(event.dataTransfer.files);

        addFiles(droppedFiles);
    }

    function addFiles(incomingFiles: File[]) {
        setSelectionError('');

        if (incomingFiles.length === 0) {
            return;
        }

        const existingFileIds = new Set(files.map((file) => file.id));

        const uniqueIncomingFiles = incomingFiles.filter((file) => {
            const validatedFile = validateFile(file, defaultUploadConfig);

            return !existingFileIds.has(validatedFile.id);
        });

        const remainingSlots =
            defaultUploadConfig.maxFiles - files.length;

        if (remainingSlots <= 0) {
            setSelectionError(
                `حداکثر ${defaultUploadConfig.maxFiles} فایل قابل انتخاب است.`,
            );

            return;
        }

        const filesToAdd = uniqueIncomingFiles.slice(0, remainingSlots);

        if (uniqueIncomingFiles.length > remainingSlots) {
            setSelectionError(
                `حداکثر ${defaultUploadConfig.maxFiles} فایل قابل انتخاب است. فقط فایل‌های مجاز به لیست اضافه شدند.`,
            );
        }

        if (filesToAdd.length === 0) {
            if (uniqueIncomingFiles.length === 0) {
                setSelectionError('این فایل‌ها قبلاً انتخاب شده‌اند.');
            }

            return;
        }

        const validatedFiles = filesToAdd.map((file) =>
            validateFile(file, defaultUploadConfig),
        );

        setFiles((currentFiles) => [
            ...currentFiles,
            ...validatedFiles,
        ]);
    }

    function removeFile(fileId: string) {
        setFiles((currentFiles) =>
            currentFiles.filter((file) => file.id !== fileId),
        );

        setSelectionError('');
    }

    return (
        <section className="uploader-card">
            <div className="uploader-card-header">
                <div>
                    <h2>انتخاب فایل Excel</h2>

                    <p>
                        فرمت‌های مجاز: xlsx و xls — حداکثر حجم هر فایل:{' '}
                        {formatFileSize(defaultUploadConfig.maxFileSizeInBytes)}
                    </p>
                </div>

                <span className="file-limit">
          {files.length} از {defaultUploadConfig.maxFiles} فایل
        </span>
            </div>

            <div
                className={`file-picker ${
                    isDragging ? 'file-picker--dragging' : ''
                }`}
                role="button"
                tabIndex={0}
                onClick={openFilePicker}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openFilePicker();
                    }
                }}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    multiple
                    onChange={handleFileChange}
                />

                <span className="file-picker-icon" aria-hidden="true">
          ⇧
        </span>

                <span className="file-picker-title">
          فایل‌ها را اینجا رها کنید
        </span>

                <span className="file-picker-description">
          یا برای انتخاب فایل کلیک کنید
        </span>
            </div>

            {selectionError && (
                <p className="selection-error" role="alert">
                    {selectionError}
                </p>
            )}

            {files.length > 0 && (
                <div className="selected-files">
                    <div className="selected-files-header">
                        <h3>فایل‌های انتخاب‌شده</h3>

                        <span>
              {files.length} فایل
            </span>
                    </div>

                    <div className="file-list">
                        {files.map((selectedFile) => (
                            <FileRow
                                key={selectedFile.id}
                                selectedFile={selectedFile}
                                onRemove={removeFile}
                            />
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
}

interface FileRowProps {
    selectedFile: SelectedFile;
    onRemove: (fileId: string) => void;
}

function FileRow({
                     selectedFile,
                     onRemove,
                 }: FileRowProps) {
    const hasErrors = selectedFile.errors.length > 0;

    return (
        <article
            className={`file-row ${
                hasErrors ? 'file-row--invalid' : ''
            }`}
        >
            <div className="file-row-main">
                <div className="file-icon" aria-hidden="true">
                    XLS
                </div>

                <div className="file-information">
                    <strong title={selectedFile.name}>
                        {selectedFile.name}
                    </strong>

                    <span>
            {formatFileSize(selectedFile.size)}
          </span>

                    {hasErrors && (
                        <ErrorList errors={selectedFile.errors} />
                    )}

                    {!hasErrors && (
                        <span className="file-status file-status--ready">
              آماده برای پردازش
            </span>
                    )}
                </div>
            </div>

            <button
                type="button"
                className="remove-file-button"
                onClick={() => onRemove(selectedFile.id)}
                aria-label={`حذف فایل ${selectedFile.name}`}
            >
                حذف
            </button>
        </article>
    );
}

interface ErrorListProps {
    errors: UploadError[];
}

function ErrorList({ errors }: ErrorListProps) {
    return (
        <ul className="file-errors">
            {errors.map((error, index) => (
                <li key={`${error.code}-${index}`}>
                    {error.message}
                </li>
            ))}
        </ul>
    );
}
