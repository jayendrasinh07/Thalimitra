import { getSupabaseClient } from './supabaseClient';
import { DeliveryAddress, AreaWaitlistEntry } from '../types';
export const mapAddress = (r:any):DeliveryAddress => ({
 id:r.id,userId:r.user_id,label:r.label,customLabel:r.custom_label??undefined,name:r.recipient_name,fullName:r.recipient_name,phone:r.recipient_phone,
 houseNumber:r.house_flat_number??undefined,building:r.building_name??undefined,floor:r.floor??undefined,street:r.street??undefined,landmark:r.landmark??undefined,
 addressLine1:r.formatted_address||[r.house_flat_number,r.building_name,r.area,r.city].filter(Boolean).join(', '),
 addressLine:r.formatted_address||[r.house_flat_number,r.building_name,r.area,r.city].filter(Boolean).join(', '),
 area:r.area,sector:r.sector??undefined,city:r.city,state:r.state,pincode:r.pincode,latitude:r.latitude??undefined,longitude:r.longitude??undefined,accuracy:r.gps_accuracy??undefined,
 placeId:r.place_id??undefined,source:r.source,instructions:r.delivery_instructions??undefined,instructionPreset:r.instruction_preset,isDefault:r.is_default,
 clusterId:r.cluster_id??'',zoneId:r.zone_id??undefined,deliveryFee:Number(r.deliveryFee??0),isServiceable:r.is_serviceable,createdAt:r.created_at,updatedAt:r.updated_at
});
const payloadFor=(a:Partial<DeliveryAddress>)=>{
 const result:Record<string,unknown>={};
 const fields:Record<string,string>={addressLine1:'formatted_address',label:'label',customLabel:'custom_label',fullName:'recipient_name',phone:'recipient_phone',houseNumber:'house_flat_number',building:'building_name',floor:'floor',street:'street',landmark:'landmark',area:'area',sector:'sector',city:'city',state:'state',pincode:'pincode',latitude:'latitude',longitude:'longitude',accuracy:'gps_accuracy',placeId:'place_id',source:'source',instructions:'delivery_instructions',instructionPreset:'instruction_preset',isDefault:'is_default'};
 for(const [key,column] of Object.entries(fields))if((a as any)[key]!==undefined)result[column]=(a as any)[key];
 return result;
};
export const addressService={
 async getUserAddresses(userId?:string):Promise<DeliveryAddress[]>{if(!userId)return [];const {data,error}=await getSupabaseClient().from('addresses').select('*').eq('user_id',userId).order('is_default',{ascending:false}).order('created_at',{ascending:false});if(error)throw error;return(data??[]).map(mapAddress);},
 async createAddress(userId:string|undefined,address:Omit<DeliveryAddress,'id'|'createdAt'|'updatedAt'>):Promise<DeliveryAddress>{if(!userId)throw new Error('Please sign in to save your delivery address.');const {data,error}=await getSupabaseClient().from('addresses').insert({...payloadFor(address),user_id:userId} as any).select().single();if(error)throw error;return mapAddress(data);},
 async updateAddress(id:string,updates:Partial<DeliveryAddress>,userId?:string):Promise<boolean>{if(!userId)throw new Error('Please sign in.');const {data,error}=await getSupabaseClient().from('addresses').update(payloadFor(updates) as any).eq('id',id).eq('user_id',userId).select('id').single();if(error)throw error;return Boolean(data);},
 async deleteAddress(id:string,userId?:string):Promise<boolean>{if(!userId)throw new Error('Please sign in.');const {data,error}=await getSupabaseClient().from('addresses').delete().eq('id',id).eq('user_id',userId).select('id').single();if(error)throw error;return Boolean(data);},
 async quoteAddress(id:string):Promise<{zoneId:string;deliveryFee:number;minOrderAmount:number}>{const {data,error}=await getSupabaseClient().rpc('quote_delivery_address',{p_address_id:id});if(error)throw error;return data as any;},
 async submitAreaWaitlist(entry:Omit<AreaWaitlistEntry,'id'|'createdAt'>):Promise<{success:boolean;error:Error|null}>{try{const {error}=await getSupabaseClient().from('area_waitlist').insert({name:entry.name,contact:entry.contact,area:entry.area,city:entry.city,pincode:entry.pincode,segment:entry.segment} as any);if(error)throw error;return{success:true,error:null};}catch(error){return{success:false,error:error as Error};}}
};
