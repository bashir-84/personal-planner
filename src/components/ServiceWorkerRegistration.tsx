"use client";
import {useEffect} from "react";
export function ServiceWorkerRegistration(){
  useEffect(()=>{if(process.env.NODE_ENV==="production"&&"serviceWorker" in navigator)navigator.serviceWorker.register("/personal-planner/sw.js",{scope:"/personal-planner/"}).catch(()=>{});},[]);
  return null;
}
