# AI Journal → Personal Planner — Task Import

Contract: personal-planner-tasks / schema_version 1.0.0.

## پرامپت آماده برای AI

تو متن ژورنال را به اقدام‌های واقعی و هنوز انجام‌نشده تبدیل می‌کنی. خاطرات، احساسات، تصمیم‌های احتمالی و کارهای تمام‌شده را به تسک تبدیل نکن. تنها خروجی، JSON معتبر و بدون کدبلاک باشد. اطلاعات ناموجود را حذف کن یا null بگذار؛ هیچ موعد، مدت‌زمان، اولویت، انعطاف‌پذیری یا ساعت جلسه را حدس نزن. تنها عنوان هر تسک لازم است. برای شناسه‌های پایدار (در صورت امکان) id بده. اگر تاریخ نسبی آمده، تنها با تاریخ مرجع ارائه‌شده و timezone معلوم آن را به ISO 8601 تبدیل کن. وقت جلسه را با deadline اشتباه نگیر. اطلاعات دقیق منبع را در notes ذخیره کن. اگر نام پروژه ذکر شده، در projects تعریف و با project_id وصل کن.

## قالب داده

سه فیلد ریشه الزامی‌اند: format برابر personal-planner-tasks، schema_version برابر 1.0.0 و tasks به شکل آرایه.
فیلدهای ریشه اختیاری: timezone و projects.
هر تسک فقط title غیرخالی لازم دارد؛ سایر فیلدها همگی اختیاری‌اند، می‌توانند حذف شوند یا null باشند:
id، description، project_id، status، priority (importance/urgency از ۱ تا ۵)، estimated_minutes، remaining_minutes، flexibility (level از ۱ تا ۵، splittable و minimum_session_minutes)، earliest_start_at، deadline_at، deadline_kind، preferred_time_windows، planned_sessions، recurrence، depends_on، tags، notes، completed_at و source.
مدت‌ها بر حسب دقیقه و تاریخ‌های مشخص به‌صورت ISO 8601 با offset هستند؛ مانند 2026-11-20T23:59:00+03:30.
شناسه id اختیاری ولی پایداربودنش برای جلوگیری از ورود تکراری توصیه می‌شود.

### مثال حداقلی

```json
{"format":"personal-planner-tasks","schema_version":"1.0.0","tasks":[{"title":"ارسال فایل"}]}
```

فایل example.json کنار این سند شامل نمونهٔ دارای فیلدهای خالی است.

## روش استفاده

۱. این README و متن ژورنال را به AI بده؛ خروجی JSON را دریافت کن.
۲. در منوی پلنر Import Tasks را باز کن (/import/).
۳. JSON را Paste یا فایل را Upload کن و Validate & Preview را بزن.
۴. خطاهای نامعتبر را اصلاح کن، هشدارها را مرور کن و Import را انجام بده.
۵. داده‌های قبلی حذف نمی‌شوند؛ اگر یک شناسهٔ وارداتی قبلاً ذخیره شده باشد، دوباره وارد نمی‌شود.

## سازگاری و محدودیت‌ها

موتور فعلی duration عددی می‌خواهد. برای مدت نامشخص فقط به‌صورت مقدار موقت و قابل‌ویرایش، ۳۰ دقیقه با estimateSource=default استفاده می‌کند؛ زمان نامشخص اصلی همچنان در importMetadata.raw خالی می‌ماند.
تکرار، وابستگی، پنجره‌های ترجیحی و جزئیات زمان‌بندی در importMetadata.raw ذخیره می‌شوند ولی موتور فعلی الزاماً از آن‌ها استفاده نمی‌کند.
یک نشست confirmed می‌تواند به روز تأییدشده منتقل شود؛ ولی ساعت دقیق آن هنوز در موتور قابل تحمیل نیست و پیش از Import هشدار داده می‌شود.
هر Import به localStorage مرورگر جاری اضافه می‌شود. فایل JSON را برای نسخهٔ پشتیبان حفظ کن.
