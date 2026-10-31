import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "آپلودر Excel | اسنپ‌باکس",
  description: "نمونه پردازش و بارگذاری فایل Excel",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
