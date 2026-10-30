import { ExcelUploader } from '@/components/ExcelUploader/ExcelUploader';

export default function HomePage() {
  return (
      <main className="page-shell">
        <section className="page-container">
          <div className="page-header">
            <span className="eyebrow">SNAPBOX ADMIN</span>

            <h1>آپلود اطلاعات سفارش‌ها</h1>

            <p>
              فایل Excel سفارش‌ها را انتخاب کنید تا پس از اعتبارسنجی و پردازش
              برای سرور ارسال شود.
            </p>
          </div>

          <ExcelUploader />
        </section>
      </main>
  );
}
