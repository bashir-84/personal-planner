import "./globals.css";import "./forms.css";import type {Metadata} from "next";
export const metadata:Metadata={title:"پلنر شخصی",description:"نمونهٔ اجرایی مرحلهٔ ۰٫۱"};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="fa" dir="rtl"><body>{children}</body></html>}
