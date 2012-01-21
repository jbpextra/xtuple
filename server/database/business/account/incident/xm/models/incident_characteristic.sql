select private.create_model(

--Model name, schema, table

'incident_characteristic', 'public', 'charass',

-- Columns

E'{
  "charass.charass_id as guid",
  "charass.charass_target_id as incident",
  "charass.charass_char_id as characteristic",
  "charass.charass_value as value"
}',

-- Rules

E'{"

-- insert rule

create or replace rule \\"_CREATE\\" as on insert to xm.incident_characteristic 
  do instead
insert into charass (
  charass_id,
  charass_target_id,
  charass_target_type,
  charass_char_id,
  charass_value )
values (
  new.guid,
  new.incident,
  \'INCDT\',
  new.characteristic,
  new.value );

","

-- update rule

create or replace rule \\"_UPDATE\\" as on update to xm.incident_characteristic
  do instead
  
update charass set
  charass_char_id = new.characteristic,
  charass_value = new.value
where ( charass_id = old.guid );

","
  
-- delete rules

create or replace rule \\"_DELETE\\" as on delete to xm.incident_characteristic   
  do instead
  
delete from charass 
where ( charass_id = old.guid );

"}',

-- Conditions, Comment, System, Nested

E'{"charass_target_type = \'INCDT\'"}', 'Incident Characteristic Model', true, true);
