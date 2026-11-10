import {createHash} from "node:crypto";
import {readFile,readdir,writeFile} from "node:fs/promises";

const root=new URL("../out/",import.meta.url);
const hash=createHash("sha256");
async function visit(directory,relative=""){
  for(const entry of (await readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
    const path=new URL(entry.name+(entry.isDirectory()?"/":""),directory);
    const name=relative+entry.name;
    if(entry.isDirectory())await visit(path,name+"/");
    else if(name!=="sw.js"){hash.update(name);hash.update(await readFile(path))}
  }
}
await visit(root);
const digest=hash.digest("hex").slice(0,12);
const path=new URL("../out/sw.js",import.meta.url);
const source=await readFile(path,"utf8");
const marker='personal-planner-shell-v1';
if(!source.includes(marker))throw new Error("Service worker cache marker missing");
await writeFile(path,source.replaceAll(marker,`personal-planner-shell-${digest}`));
