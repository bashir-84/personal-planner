import "./globals.css";import "./forms.css";import "./workload.css";import "./minimal.css";import "./test-environment.css";import type {Metadata} from "next";
import localFont from "next/font/local";
const vazirmatn=localFont({src:"../../public/fonts/Vazirmatn-VariableFont_wght.ttf",variable:"--font-vazirmatn",display:"swap",weight:"100 900"});
export const metadata:Metadata={title:"پلنر شخصی",description:"نمونهٔ اجرایی مرحلهٔ ۰٫۱"};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="fa" dir="rtl"><body className={vazirmatn.variable}>{children}</body></html>}
