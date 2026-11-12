"use client";
import {useCallback,useEffect,useState} from "react";
import {getSyncSummary} from "@/storage/indexed";
import type {SyncSummary} from "./types";

const initial:SyncSummary={connected:false,pending:0,syncing:false,offline:false};
export function useSyncStatus(){const[summary,setSummary]=useState(initial);const[storageError,setStorageError]=useState<string>();const refresh=useCallback(async(syncing=false)=>{try{setSummary(await getSyncSummary(syncing));setStorageError(undefined)}catch(error){setStorageError(error instanceof Error?error.message:"IndexedDB is unavailable")}},[]);useEffect(()=>{const update=()=>void refresh();void refresh();window.addEventListener("planner-sync-state",update);window.addEventListener("online",update);window.addEventListener("offline",update);return()=>{window.removeEventListener("planner-sync-state",update);window.removeEventListener("online",update);window.removeEventListener("offline",update)}},[refresh]);return{summary,storageError,refresh}}
