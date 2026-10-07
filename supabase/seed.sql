-- Development samples, not a statement of actual prices or offerings. Do not seed production.
insert into public.categories(id,slug,name,position) values
('10000000-0000-4000-8000-000000000001','signature-kaapi','Signature Kaapi',1),
('10000000-0000-4000-8000-000000000002','hot-coffee','Hot coffee',2),
('10000000-0000-4000-8000-000000000003','cold-coffee','Cold coffee',3),
('10000000-0000-4000-8000-000000000004','small-plates','Small plates',4)
on conflict(id) do nothing;
insert into public.menu_items(id,category_id,name,description,price_paise,dietary,published,featured,sample_data) values
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Classic filter kaapi','A warm, slow-brewed cup with steamed milk.',14000,'vegetarian',true,true,true),
('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','Cappuccino','Espresso, steamed milk and a soft foam finish.',18000,'vegetarian',true,false,true),
('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002','Americano','Espresso with hot water. Simple and full of character.',15000,'vegan',true,false,true),
('20000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000003','Iced coffee','Chilled coffee over ice for an unhurried afternoon.',19000,'vegan',true,false,true),
('20000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000004','Grilled vegetable toast','Seasonal vegetables on golden toasted bread.',22000,'vegetarian',true,false,true),
('20000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000004','Chocolate brownie','A small, rich finish to your coffee break.',16000,'vegetarian',true,false,true)
on conflict(id) do nothing;
