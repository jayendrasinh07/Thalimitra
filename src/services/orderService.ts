import { getSupabaseClient } from './supabaseClient';
import { CancellationReason, OneTimeOrder, PaymentStatus, OrderStatus, ServiceMealType } from '../types';
import { mapAddress } from './addressService';
import { dietLabel } from './menuService';
export interface CreateOrderPayload {userId:string;addressId:string;orderDate:string;mealType:ServiceMealType;deliverySlotId:string;mealId:string;quantity:number;selectedAddons:Record<string,number>;notes?:string;promotionCode?:string;preferences:{spiceLevel:string;oilLevel:string};}
const pending=new Map<string,Promise<{order:OneTimeOrder|null;error:Error|null}>>();
let customerOrderChannelSequence=0;
export const toCustomerOrder=(r:any):OneTimeOrder=>{
 const i=r.order_items?.[0]; if(!r.id||!i||!r.address_snapshot)throw new Error('The server returned an incomplete order. Please refresh your order history.');
 const address=mapAddress(r.address_snapshot);const pref=i.preparation_preferences??{};
 const statuses:Record<string,OrderStatus>={pending:'CREATED',confirmed:'CONFIRMED',preparing:'PREPARING',ready:'PACKED',out_for_delivery:'OUT_FOR_DELIVERY',delivered:'DELIVERED',cancelled:'CANCELLED'};
 return {id:r.id,orderNumber:r.order_number,userId:r.user_id,userName:address.fullName,userPhone:address.phone,orderType:'ONE_TIME',mealId:i.meal_id??'',mealName:i.meal_name_snapshot,mealImage:'',scheduledDate:r.order_date,scheduledDateLabel:r.order_date,mealSlot:r.meal_type,deliverySlotId:r.delivery_slot_id??'',deliverySlotLabel:r.address_snapshot.slotLabel??'',quantity:i.quantity,
 customizations:{spiceLevel:pref.spiceLevel??'Regular',oilLevel:pref.oilLevel??'Standard',dietVariant:dietLabel(pref.dietType??'standard_gujarati')},
 addOns:(i.order_customizations??[]).map((c:any)=>({id:c.customization_id??c.id,name:c.customization_name_snapshot,price:Number(c.unit_price),quantity:c.quantity})),
 address:{...address,addressLine:address.addressLine??address.addressLine1},deliveryAddressSnapshot:address,deliveryZoneId:r.address_snapshot.zone_id??undefined,
 subtotal:Number(r.subtotal),addOnsTotal:Number(r.customization_total),deliveryFee:Number(r.delivery_fee),discount:Number(r.discount),promotionCode:r.promotion_code_snapshot??undefined,promotionName:r.promotion_name_snapshot??undefined,total:Number(r.grand_total),paymentMethod:'CashOnDelivery',paymentStatus:r.payment_status.toUpperCase() as PaymentStatus,orderStatus:statuses[r.status],estimatedDeliveryTime:r.address_snapshot.slotLabel??'',createdAt:r.created_at,traceabilityMealId:'',notes:r.notes??'',
 cancellationReason:r.cancellation_reason as CancellationReason|undefined,cancellationNote:r.cancellation_note??undefined,cancelledAt:r.cancelled_at??undefined};
};
export const orderService={
 async createOrder(p:CreateOrderPayload):Promise<{order:OneTimeOrder|null;error:Error|null}>{
  const canonical=JSON.stringify({...p,selectedAddons:Object.fromEntries(Object.entries(p.selectedAddons).filter(([,q])=>q>0).sort(([a],[b])=>a.localeCompare(b)))});
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical));
  const fingerprint=Array.from(new Uint8Array(bytes)).map(b=>b.toString(16).padStart(2,'0')).join('');
  const storageKey=`teffein_checkout:${p.userId}:${fingerprint}`;
  if(pending.has(storageKey))return pending.get(storageKey)!;
  const task=(async()=>{try{
   const requestKey=sessionStorage.getItem(storageKey)||crypto.randomUUID();sessionStorage.setItem(storageKey,requestKey);
   const {data,error}=await getSupabaseClient().rpc('place_order_secure',{
    p_order_date:p.orderDate,p_meal_type:p.mealType,p_delivery_slot_id:p.deliverySlotId,p_address_id:p.addressId,p_meal_id:p.mealId,p_quantity:p.quantity,
    p_customizations:Object.entries(p.selectedAddons).filter(([,quantity])=>quantity>0).map(([customization_id,quantity])=>({customization_id,quantity})),p_notes:p.notes||null,p_idempotency_key:requestKey,p_preferences:p.preferences,p_promotion_code:p.promotionCode||null
   });
   if(error)throw error;const order=toCustomerOrder(data);sessionStorage.removeItem(storageKey);return{order,error:null};
  }catch(error){return{order:null,error:error as Error};}})();
  pending.set(storageKey,task);try{return await task;}finally{pending.delete(storageKey);}
 },
 async getUserOrders(userId:string):Promise<OneTimeOrder[]>{const {data,error}=await getSupabaseClient().from('orders').select('*,order_items(*,order_customizations(*))').eq('user_id',userId).order('created_at',{ascending:false});if(error)throw error;return(data??[]).map(toCustomerOrder);},
 async cancelOrder(id:string,reason:CancellationReason,note=''):Promise<OneTimeOrder>{
  const cleanNote=note.trim();
  if(!id||!['changed_mind','ordered_by_mistake','schedule_changed','address_issue','other'].includes(reason)
   ||cleanNote.length>500||(reason==='other'&&cleanNote.length<5))throw new Error('Choose a valid cancellation reason.');
  const {data,error}=await getSupabaseClient().rpc('cancel_customer_order',{p_order_id:id,p_reason:reason,p_note:cleanNote||null});
  if(error)throw error;return toCustomerOrder(data);
 },
 subscribe(userId:string,onChange:()=>void):()=>void{
  if(!userId)throw new Error('Customer identity is required.');
  const client=getSupabaseClient();let active=true;
  const channel=client.channel(`customer-orders-${userId}-${++customerOrderChannelSequence}`)
   .on('postgres_changes',{event:'UPDATE',schema:'public',table:'orders',filter:`user_id=eq.${userId}`},()=>{if(active)onChange();})
   .subscribe();
  return()=>{active=false;void client.removeChannel(channel);};
 }
};

