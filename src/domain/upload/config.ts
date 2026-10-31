import type { UploadConfig } from "./types";

export const DEFAULT_UPLOAD_CONFIG: UploadConfig = {
  acceptedExtensions: ["xlsx", "xls"],
  requiredColumns: ["orderId", "recipientName", "phoneNumber"],
  headerAliases: {
    orderId: ["Order ID", "order_id", "کد سفارش", "شماره سفارش"],
    recipientName: ["Recipient Name", "recipient_name", "نام گیرنده"],
    phoneNumber: ["Phone Number", "phone_number", "شماره تماس", "تلفن"],
  },
  headerRowIndex: 0,
  chunkSizeInBytes: 5 * 1024 * 1024,
  maxErrorSamples: 20,
};
