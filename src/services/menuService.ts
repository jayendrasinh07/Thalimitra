import { getSupabaseClient } from './supabaseClient';
import { MealType } from '../types/database.types';
import { DeliverySlot, ServiceMealType } from '../types';
export interface DatabaseMeal { id:string; name:string; description:string; imageUrl?:string; mealType:MealType; dietType:string; basePrice:number; isActive:boolean; }
export interface DatabaseMealCustomization { id:string; mealId?:string|null; name:string; description?:string; price:number; isActive:boolean; }
export interface DatabaseDeliverySlot { id:string; name:string; mealType:ServiceMealType; startTime:string; endTime:string; maxOrders:number; cutoffTime?:string|null; isActive:boolean; }
export interface DatabaseDayMenu { id:string; menuDate:string; isPublished:boolean; meals:DatabaseMeal[]; }
const meal = (r:any, serviceMealType?:ServiceMealType):DatabaseMeal => ({id:r.id,name:r.name,description:r.description??'',imageUrl:r.image_url??undefined,mealType:serviceMealType??r.meal_type,dietType:r.diet_type,basePrice:Number(r.base_price),isActive:r.is_active});
export const dietLabel = (value:string) => ({standard_gujarati:'Standard Gujarati',jain_satvik:'Jain Satvik',kathiyawadi:'Kathiyawadi',low_oil_fit:'Low Oil Fit',north_indian:'North Indian'}[value]??value);
export const formatSlotTime = (time:string) => { const [h,m]=time.split(':').map(Number); return `${h%12||12}:${String(m).padStart(2,'0')} ${h<12?'AM':'PM'}`; };
export const mapDeliverySlot = (r:any):DeliverySlot => ({id:r.id,mealSlot:r.meal_type,windowLabel:`${formatSlotTime(r.start_time)} – ${formatSlotTime(r.end_time)}`,startTime:r.start_time,endTime:r.end_time,maxCapacity:Number(r.max_orders),bookedCount:Number(r.booked_portions)});
export const menuService = {
 async getActiveMeals():Promise<DatabaseMeal[]> { const {data,error}=await getSupabaseClient().from('meals').select('*').eq('is_active',true).order('name'); if(error)throw error; return (data??[]).map(row=>meal(row)); },
 async getMealCustomizations(mealId?:string):Promise<DatabaseMealCustomization[]> {
  if(!mealId)return [];
  const {data,error}=await getSupabaseClient().from('meal_customizations').select('*').eq('is_active',true).or(`meal_id.is.null,meal_id.eq.${mealId}`).order('price');
  if(error)throw error; return (data??[]).map((r:any)=>({id:r.id,mealId:r.meal_id,name:r.name,description:r.description,price:Number(r.price),isActive:r.is_active}));
 },
 async getDeliverySlots(mealType:ServiceMealType,date:string):Promise<DeliverySlot[]> {
  const {data,error}=await getSupabaseClient().rpc('get_delivery_slot_availability',{p_order_date:date,p_meal_type:mealType});
  if(error)throw error; return (data??[]).map(mapDeliverySlot);
 },
 async getMenuForDate(date:string):Promise<DatabaseDayMenu|null> {
  const menus=await this.getMenusForDates([date]);
  return menus[date]??null;
 },
 async getMenusForDates(dates:string[]):Promise<Record<string,DatabaseDayMenu|null>> {
  const uniqueDates=[...new Set(dates.filter(date=>/^\d{4}-\d{2}-\d{2}$/.test(date)))];
  const empty=Object.fromEntries(uniqueDates.map(date=>[date,null])) as Record<string,DatabaseDayMenu|null>;
  if(uniqueDates.length===0)return empty;
  const client=getSupabaseClient();
  const {data:days,error}=await client.from('menu_days').select('id,menu_date,is_published').in('menu_date',uniqueDates).eq('is_published',true);
  if(error)throw error;
  if(!days?.length)return empty;
  const {data:items,error:itemError}=await client.from('menu_items').select('menu_day_id,meal_id,service_meal_types,availability,display_order,meals(*)').in('menu_day_id',days.map((day:any)=>day.id)).eq('availability',true).order('display_order');
  if(itemError)throw itemError;
  for(const day of days){
   empty[day.menu_date]={
    id:day.id,
    menuDate:day.menu_date,
    isPublished:day.is_published,
    meals:(items??[]).filter((item:any)=>item.menu_day_id===day.id&&item.meals?.is_active).flatMap((item:any)=>(item.service_meal_types??[]).map((serviceMealType:ServiceMealType)=>meal(item.meals,serviceMealType)))
   };
  }
  return empty;
 }
};
