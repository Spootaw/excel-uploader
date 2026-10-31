import type { UploadConfig, UploadError } from "./types";
import { getFileExtension } from "./file-utils";

export function validateFileExtension(
  file: File,
  config: UploadConfig,
): UploadError | undefined {
  return config.acceptedExtensions
    .map((x) => x.toLowerCase().replace(/^\./, ""))
    .includes(getFileExtension(file.name))
    ? undefined
    : {
        code: "INVALID_EXTENSION",
        message: `فقط فایل‌های ${config.acceptedExtensions.map((x) => "." + x.replace(/^\./, "")).join("، ")} پذیرفته می‌شوند.`,
      };
}
