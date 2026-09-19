"""Local/CI database only. Real concurrent sessions verify capacity and retry locks."""
import concurrent.futures
import json
import os
from pathlib import Path
import subprocess
import uuid

PSQL = os.environ.get('PSQL', 'psql')

def sql(query, check=True):
    result = subprocess.run([PSQL, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], input=query, text=True, capture_output=True)
    if check and result.returncode:
        raise RuntimeError(result.stderr)
    return result

u, address, meal, slot = [str(uuid.uuid4()) for _ in range(4)]
date = sql("select ((clock_timestamp() at time zone 'Asia/Kolkata')::date+1)::text").stdout.strip()

def order(key, hold=False):
    return sql(f"""begin; set local role authenticated;
      set local request.jwt.claim.sub='{u}';
      select public.place_order_secure('{date}','lunch','{slot}','{address}','{meal}',1,'[]',null,'{key}')->>'id';
      {'select pg_sleep(0.4);' if hold else ''} commit;""", False)

def parallel(fn, values):
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        return list(pool.map(fn, values))

try:
    sql(f"""
      insert into auth.users(id,email,raw_user_meta_data) values('{u}','{u}@example.invalid','{{}}');
      insert into public.addresses(id,user_id,recipient_name,recipient_phone,area,pincode) values('{address}','{u}','Concurrency test','0000000000','Kudasan','382421');
      insert into public.meals(id,name,meal_type,base_price) values('{meal}','Concurrency test','lunch',119);
      insert into public.menu_days(menu_date,is_published) values('{date}',true) on conflict(menu_date) do nothing;
      insert into public.menu_items(menu_day_id,meal_id,service_meal_types) select id,'{meal}',array['lunch'] from public.menu_days where menu_date='{date}';
      insert into public.delivery_slots(id,name,meal_type,start_time,end_time,cutoff_time,max_orders) values('{slot}','Concurrency test','lunch','12:00','12:45','10:30',1);
    """)
    results = parallel(lambda key: order(key, True), [str(uuid.uuid4()), str(uuid.uuid4())])
    assert sum(r.returncode == 0 for r in results) == 1, [(r.stdout,r.stderr) for r in results]
    assert any('insufficient remaining portions' in r.stderr for r in results), results
    assert sql(f"select sum(i.quantity) from public.orders o join public.order_items i on i.order_id=o.id where o.delivery_slot_id='{slot}'").stdout.strip() == '1'
    sql(f"delete from public.orders where user_id='{u}';")
    key = str(uuid.uuid4())
    results = parallel(lambda _: order(key, True), [1, 2])
    assert all(r.returncode == 0 for r in results), [(r.stdout,r.stderr) for r in results]
    assert len({r.stdout.strip() for r in results}) == 1
    assert sql(f"select count(*) from public.orders where user_id='{u}'").stdout.strip() == '1'
    def default_address(_):
        return sql(f"""begin;set local role authenticated;set local request.jwt.claim.sub='{u}';
          insert into public.addresses(user_id,recipient_name,recipient_phone,area,pincode,is_default)
          values('{u}','Concurrent default','0000000000','Kudasan','382421',true);select pg_sleep(0.2);commit;""",False)
    results = parallel(default_address, [1, 2])
    assert all(r.returncode == 0 for r in results), [(r.stdout,r.stderr) for r in results]
    assert sql(f"select count(*) from public.addresses where user_id='{u}' and is_default").stdout.strip() == '1'
    print('PASS: concurrent final portion, duplicate checkout retry, and default addresses')
finally:
    sql(f"""delete from public.orders where user_id='{u}';
      delete from public.menu_items where meal_id='{meal}';
      delete from public.meals where id='{meal}';delete from public.delivery_slots where id='{slot}';
      delete from auth.users where id='{u}';
      delete from public.menu_days d where menu_date='{date}' and not exists(select 1 from public.menu_items i where i.menu_day_id=d.id);
    """)
