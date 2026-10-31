"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ChangeEvent, DragEvent } from "react";
import type {
  ParseResult,
  SelectedFile,
  UploadPayload,
  UploadSession,
} from "@/domain/upload/types";
import { DEFAULT_UPLOAD_CONFIG } from "@/domain/upload/config";
import { createFileId, formatBytes } from "@/domain/upload/file-utils";
import { validateFileExtension } from "@/domain/upload/file-validator";
import { UploadServiceError } from "@/domain/upload/upload-errors";
import { uploadService } from "@/services/upload/upload-service-factory";
import "./excel-uploader.css";

export interface ExcelUploaderProps {
  config?: Partial<typeof DEFAULT_UPLOAD_CONFIG>;
  onComplete?: (
    file: File,
    result: { uploadId: string; message: string },
  ) => void;
  onError?: (file: File, error: Error) => void;
  multiple?: boolean;
}
const emptyParse = (): ParseResult => ({
  headers: [],
  totalRows: 0,
  validRows: 0,
  invalidRows: 0,
  missingColumns: [],
  errors: [],
  errorsTruncated: false,
});
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : "خطای پیش‌بینی‌نشده رخ داد.";

export default function ExcelUploader({
  config: configOverride,
  onComplete,
  onError,
  multiple = true,
}: ExcelUploaderProps) {
  const config = useMemo(
    () => ({
      ...DEFAULT_UPLOAD_CONFIG,
      ...configOverride,
      headerAliases: {
        ...DEFAULT_UPLOAD_CONFIG.headerAliases,
        ...configOverride?.headerAliases,
      },
      requiredColumns:
        configOverride?.requiredColumns ??
        DEFAULT_UPLOAD_CONFIG.requiredColumns,
      acceptedExtensions:
        configOverride?.acceptedExtensions ??
        DEFAULT_UPLOAD_CONFIG.acceptedExtensions,
    }),
    [configOverride],
  );
  const [items, setItems] = useState<SelectedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const controllers = useRef(new Map<string, AbortController>());
  const update = useCallback(
    (id: string, changes: Partial<SelectedFile>) =>
      setItems((current) =>
        current.map((item) =>
          item.id === id ? { ...item, ...changes } : item,
        ),
      ),
    [],
  );

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files);
      setItems((current) => {
        const next = [...current];
        for (const file of list) {
          const id = createFileId(file);
          if (next.some((item) => item.id === id)) continue;
          const validation = validateFileExtension(file, config);
          next.push({
            id,
            file,
            name: file.name,
            size: file.size,
            status: validation ? "invalid" : "ready",
            progress: 0,
            loadedBytes: 0,
            errors: validation ? [validation] : [],
          });
        }
        return next;
      });
    },
    [config],
  );

  const parseItem = useCallback(
    async (item: SelectedFile) => {
      update(item.id, { status: "parsing", errors: [], message: undefined });
      try {
        const parsed = await uploadService.parse(item.file, config);
        const invalid =
          parsed.invalidRows > 0 || parsed.missingColumns.length > 0;
        update(item.id, {
          parsed,
          status: invalid ? "invalid" : "parsed",
          errors: parsed.errors,
          message: invalid
            ? "لطفاً خطاهای فایل را اصلاح کنید."
            : "فایل آمادهٔ بارگذاری است.",
        });
      } catch (error) {
        update(item.id, {
          status: "failed",
          errors: [{ code: "PARSING_ERROR", message: errorText(error) }],
        });
        onError?.(
          item.file,
          error instanceof Error ? error : new Error(errorText(error)),
        );
      }
    },
    [config, onError, update],
  );

  const uploadItem = useCallback(
    async (item: SelectedFile) => {
      let parsed = item.parsed;
      if (!parsed) {
        try {
          parsed = await uploadService.parse(item.file, config);
        } catch (error) {
          update(item.id, {
            status: "failed",
            errors: [{ code: "PARSING_ERROR", message: errorText(error) }],
          });
          return;
        }
      }
      if (parsed.invalidRows || parsed.missingColumns.length) {
        update(item.id, {
          parsed,
          status: "invalid",
          errors: parsed.errors,
          message: "ابتدا خطاهای فایل را اصلاح کنید.",
        });
        return;
      }
      const controller = new AbortController();
      controllers.current.set(item.id, controller);
      update(item.id, {
        parsed,
        status: "uploading",
        progress: item.progress,
        message: "در حال بارگذاری…",
      });
      const payload: UploadPayload = {
        file: item.file,
        headers: parsed.headers,
        totalRows: parsed.totalRows,
        validRows: parsed.validRows,
        invalidRows: parsed.invalidRows,
      };
      try {
        const result = await uploadService.upload(
          payload,
          config,
          item.id,
          controller.signal,
          (session: UploadSession) =>
            update(item.id, { session, savedSession: true }),
          (progress) =>
            update(item.id, {
              progress: progress.percent,
              loadedBytes: progress.loaded,
            }),
        );
        update(item.id, {
          status: "uploaded",
          progress: 100,
          loadedBytes: item.size,
          message: result.message,
        });
        onComplete?.(item.file, result);
      } catch (error) {
        const cancelled =
          error instanceof UploadServiceError && error.code === "CANCELLED";
        update(item.id, {
          status: cancelled ? "paused" : "failed",
          message: cancelled
            ? "بارگذاری متوقف شد؛ برای ادامه دوباره اقدام کنید."
            : errorText(error),
        });
        if (!cancelled)
          onError?.(
            item.file,
            error instanceof Error ? error : new Error(errorText(error)),
          );
      } finally {
        controllers.current.delete(item.id);
      }
    },
    [config, onComplete, onError, update],
  );

  const stop = (id: string) => controllers.current.get(id)?.abort();
  const remove = (id: string) => {
    controllers.current.get(id)?.abort();
    setItems((current) => current.filter((item) => item.id !== id));
  };
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!controllers.current.size) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      controllers.current.forEach((controller) => controller.abort());
    };
  }, []);
  const onInput = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) addFiles(event.target.files);
    event.target.value = "";
  };
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files) addFiles(event.dataTransfer.files);
  };
  const accepted = config.acceptedExtensions
    .map((extension) => `.${extension.replace(/^\./, "")}`)
    .join(",");
  return (
    <section
      className="excel-uploader"
      dir="rtl"
      aria-label="بارگذاری فایل اکسل"
    >
      <h2 className="excel-uploader__title">بارگذاری فایل اکسل</h2>
      <p className="excel-uploader__hint">
        فایل‌های {accepted} را انتخاب یا اینجا رها کنید. فایل پیش از ارسال بررسی
        می‌شود.
      </p>
      <div
        className={`excel-uploader__dropzone${dragging ? " is-dragging" : ""}`}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node))
            setDragging(false);
        }}
        onDrop={onDrop}
      >
        <label className="excel-uploader__pick">
          انتخاب فایل
          <input
            type="file"
            accept={accepted}
            multiple={multiple}
            onChange={onInput}
          />
        </label>
        <span>یا فایل را به این بخش بکشید</span>
      </div>
      {items.length > 0 && (
        <ul className="excel-uploader__list">
          {items.map((item) => (
            <li className="excel-uploader__item" key={item.id}>
              <div className="excel-uploader__filehead">
                <div>
                  <strong>{item.name}</strong>
                  <small>
                    {formatBytes(item.size)}
                    {item.parsed
                      ? ` · ${item.parsed.totalRows.toLocaleString("fa-IR")} ردیف`
                      : ""}
                  </small>
                </div>
                <span
                  className={`excel-uploader__status status-${item.status}`}
                >
                  {
                    (
                      {
                        invalid: "نیازمند اصلاح",
                        ready: "آمادهٔ بررسی",
                        parsing: "در حال بررسی",
                        parsed: "آمادهٔ ارسال",
                        uploading: "در حال بارگذاری",
                        paused: "متوقف‌شده",
                        uploaded: "تکمیل‌شده",
                        failed: "ناموفق",
                      } as Record<string, string>
                    )[item.status]
                  }
                </span>
              </div>
              {item.status === "uploading" || item.progress > 0 ? (
                <div
                  className="excel-uploader__progress"
                  role="progressbar"
                  aria-valuenow={item.progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <span style={{ width: `${item.progress}%` }} />
                </div>
              ) : null}
              {item.message && (
                <p className="excel-uploader__message">{item.message}</p>
              )}
              {item.errors.length > 0 && (
                <ul className="excel-uploader__errors">
                  {item.errors.slice(0, 8).map((error, index) => (
                    <li key={`${error.code}-${index}`}>
                      {error.rowNumber
                        ? `ردیف ${error.rowNumber.toLocaleString("fa-IR")}: `
                        : ""}
                      {error.message}
                    </li>
                  ))}
                  {item.parsed?.errorsTruncated && (
                    <li>نمونهٔ بیشتری از خطاها موجود است.</li>
                  )}
                </ul>
              )}
              <div className="excel-uploader__actions">
                {["ready", "failed"].includes(item.status) && (
                  <button type="button" onClick={() => void parseItem(item)}>
                    بررسی فایل
                  </button>
                )}
                {["parsed", "paused", "failed"].includes(item.status) && (
                  <button type="button" onClick={() => void uploadItem(item)}>
                    {item.status === "paused" || item.savedSession
                      ? "ادامهٔ بارگذاری"
                      : "بارگذاری"}
                  </button>
                )}
                {item.status === "uploading" && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => stop(item.id)}
                  >
                    توقف
                  </button>
                )}
                {item.status !== "uploading" && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => remove(item.id)}
                  >
                    حذف
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="excel-uploader__privacy">
        در زمان بارگذاری، بستن صفحه باعث توقف کار می‌شود؛ نشست و بخش‌های
        تأییدشده برای ادامه ذخیره می‌شوند.
      </p>
    </section>
  );
}
