import {XMLParser} from "fast-xml-parser";import {db} from "./supabase";import {evaluate,Rules} from "./filter";import { telegramJob } from "./telegram";
type Item={title:string;link:string;description:string;publishedAt?:string};
const arr=<T,>(x:T|T[]|undefined):T[]=>x?Array.isArray(x)?x:[x]:[];
const clean=(v:unknown)=>typeof v==="string"?v:typeof v==="object"&&v&&"#text" in v?String((v as any)["#text"]):"";
async function readFeed(url:string):Promise<Item[]>{const r=await fetch(url,{headers:{"user-agent":"RadarVagas/1.0 (+painel pessoal)"},cache:"no-store"});if(!r.ok)throw new Error(`${url}: HTTP ${r.status}`);const xml=await r.text();const p=new XMLParser({ignoreAttributes:false});const x=p.parse(xml);if(x.rss?.channel?.item)return arr(x.rss.channel.item).map((i:any)=>({title:clean(i.title),link:clean(i.link),description:clean(i.description||i["content:encoded"]),publishedAt:clean(i.pubDate)}));return arr(x.feed?.entry).map((i:any)=>({title:clean(i.title),link:typeof i.link==="string"?i.link:i.link?.["@_href"]||arr(i.link)[0]?.["@_href"],description:clean(i.summary||i.content),publishedAt:clean(i.updated||i.published)}))}
function cleanJobTitle(title: string) {
  return title
    // Converte entidades que podem representar travessões
    .replace(/&ndash;|&#8211;|&#x2013;/gi, "–")
    .replace(/&mdash;|&#8212;|&#x2014;/gi, "—")

    // Remove marcações HTML que possam vir no título
    .replace(/<[^>]*>/g, " ")

    // Usa somente o texto anterior ao primeiro separador
    .split(/\s*(?:–|—|\||•)\s*/)[0]

    // Corrige espaços duplicados
    .replace(/\s+/g, " ")
    .trim();
}
export async function collect(){const D=db();const [{data:sources},{data:settings}]=await Promise.all([D.from("sources").select("*").eq("enabled",true),D.from("settings").select("*").single()]);if(!settings)throw new Error("Configurações ausentes");const rules:Rules={include:settings.include_keywords||[],exclude:settings.exclude_keywords||[],cities:settings.cities||[],minScore:settings.min_score||60};let found=0,sent=0,errors:string[]=[];for(const source of sources||[]){try{if(source.kind!=="rss")continue;for(const item of await readFeed(source.url)){if(!item.link||!item.title)continue;const result=evaluate(`${item.title} ${item.description}`,rules);const {data,error}=await D.from("jobs").upsert({source_id:source.id,external_id:item.link,title:item.title,url:item.link,description:item.description,published_at:item.publishedAt||null,score:result.score,status:result.approved?"approved":"ignored",reasons:result.reasons},{onConflict:"external_id",ignoreDuplicates:true}).select("id").maybeSingle();if(error)throw error;if(data){found++;if(result.approved){await telegramJob({
  title: cleanJobTitle(item.title),
  url: item.link,
  source: source.name,
  score: result.score
});await D.from("jobs").update({notified_at:new Date().toISOString()}).eq("id",data.id);sent++}}}}catch(e){errors.push(`${source.name}: ${e instanceof Error?e.message:String(e)}`)}}return {found,sent,errors}}
