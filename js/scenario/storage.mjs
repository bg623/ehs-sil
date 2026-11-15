import {parseProject} from './schema.mjs';
export const STORAGE_KEY='ehs-sil-scenario-project-v1';
export function load(storage){try{const raw=storage.getItem(STORAGE_KEY);return raw?{project:parseProject(raw),status:'loaded'}:{project:null,status:'empty'};}catch(e){return {project:null,status:'failed',error:e.message};}}
export function save(storage,project){try{parseProject(JSON.stringify(project));storage.setItem(STORAGE_KEY,JSON.stringify(project));return {status:'saved'};}catch(e){return {status:'failed',error:e.message};}}
export function clear(storage){storage.removeItem(STORAGE_KEY);}
