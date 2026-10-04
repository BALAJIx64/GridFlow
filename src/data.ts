export type Consumer = { id:string; name:string; account:string; address:string; zone:string; plan:string; usage:number; status:'Active'|'Inactive' }
export type Meter = { id:string; serial:string; consumer:string; consumerId?:string; zone:string; reading:number; status:'Online'|'Offline'|'Installing'; signal:number }
export type Bill = { id:string; dbId?:string; consumer:string; account:string; period:string; due:string; amount:number; usage:number; status:'Paid'|'Pending'|'Overdue' }
export type Technician = { id:string; name:string; initials:string; zone:string; jobs:number; status:'Available'|'On site'|'Off duty' }
export type ServiceRecord = { id:string; summary:string; technician:string; consumer:string; meter:string; status:string; scheduledAt:string }
