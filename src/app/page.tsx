import ExcelUploader from "@/components/ExcelUploader";

export default function Home() {
  return (
    <main className="page">
      <nav className="topbar">
        <span className="brand-mark">S</span>
        <span>پنل مدیریت اسنپ‌باکس</span>
        <span className="demo">نسخه آزمایشی</span>
      </nav>
      <section className="intro">
        <span className="eyebrow">مدیریت مرسوله‌ها</span>
        <h1>بارگذاری گروهی سفارش‌ها</h1>
        <p>
          فایل Excel را انتخاب کنید تا بررسی، پردازش و برای ثبت به سرور ارسال
          شود.
        </p>
      </section>
      <ExcelUploader />
      <p className="footnote">
        فایل‌های شما در این نسخه آزمایشی به سرور ارسال نمی‌شوند.
      </p>
    </main>
  );
}
