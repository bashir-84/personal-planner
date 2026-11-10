import "./globals.css";import "./forms.css";import "./workload.css";import "./minimal.css";import "./test-environment.css";import "./task-lifecycle.css";import type {Metadata} from "next";
import localFont from "next/font/local";
import "./white-theme.css";
const vazirmatn=localFont({src:"../../public/fonts/Vazirmatn-VariableFont_wght.ttf",variable:"--font-vazirmatn",display:"swap",weight:"100 900"});
export const metadata:Metadata={title:"Personal Planner",description:"A compact, capacity-aware personal planner"};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en" dir="ltr"><body className={vazirmatn.variable}>{children}</body></html>}
