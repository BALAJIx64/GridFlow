import React from 'react'
import { ChevronDown, Search } from 'lucide-react'

/* Shared presentational components, moved verbatim from App.tsx so new pages can reuse them. */
export function Pill({children,tone='gray',dot=false}:{children:React.ReactNode;tone?:string;dot?:boolean}){return <span className={`pill pill-${tone}`}>{dot&&<i/>}{children}</span>}
export function SectionHeading({eyebrow,title,subtitle,action}:{eyebrow:string;title:string;subtitle:string;action?:React.ReactNode}){return <div className="section-title-row"><div><div className="eyebrow page-eyebrow"><span/>{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>}
export function SelectControl({value,onChange,options}:{value:string;onChange:(v:string)=>void;options:(string|{value:string;label:string})[]}){return <label className="select-wrap"><select value={value} onChange={e=>onChange(e.target.value)}>{options.map(o=><option key={typeof o==='string'?o:o.value} value={typeof o==='string'?o:o.value}>{typeof o==='string'?o:o.label}</option>)}</select><ChevronDown size={14}/></label>}
export function SearchControl({value,onChange,placeholder='Search...'}:{value:string;onChange:(v:string)=>void;placeholder?:string}){return <label className="table-search"><Search size={15}/><input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/></label>}
export function PageToolbar({children}:{children:React.ReactNode}){return <div className="page-toolbar">{children}</div>}
export function DataTable({headers,children}:{headers:string[];children:React.ReactNode}){return <div className="table-wrap"><table><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>}
export function StatusPill({status}:{status:string}){const map:Record<string,string>={Active:'green',Paid:'green',Online:'green',Available:'green',Completed:'green',Pending:'amber','On site':'blue','In progress':'blue',Offline:'red',Overdue:'red',Suspended:'red',Inactive:'gray',Installing:'violet','Off duty':'gray',Scheduled:'amber'};return <Pill tone={map[status]||'gray'} dot>{status}</Pill>}
