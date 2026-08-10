-- D-034 corrige el crecimiento accidental de los extractores de mercado v2.
-- La limpieza se limita a contratos sin categoría pública y a capturas
-- redundantes de staging; los snapshots profesionales no se modifican.

create temporary table d034_market_contracts as
select *
from public.market_contracts
where category_id is not null;

create temporary table d034_market_price_snapshots as
select distinct on (snapshots.contract_id) snapshots.*
from public.market_price_snapshots as snapshots
join d034_market_contracts as contracts
  on contracts.id = snapshots.contract_id
order by
  snapshots.contract_id,
  snapshots.observed_at desc,
  snapshots.captured_at desc,
  snapshots.id desc;

-- TRUNCATE evita generar decenas de miles de tuplas muertas con payloads
-- grandes. Las tablas temporales conservan solo las filas que deben sobrevivir
-- y la operación completa sigue siendo transaccional.
truncate table
  public.market_price_snapshots,
  public.market_contracts;

insert into public.market_contracts
overriding system value
select * from d034_market_contracts;

insert into public.market_price_snapshots
overriding system value
select * from d034_market_price_snapshots;

update public.market_connectors
set extractor_version = case id
  when 'kalshi-oscars' then 'kalshi-v3'
  when 'polymarket-oscars' then 'polymarket-v3'
end
where id in ('kalshi-oscars', 'polymarket-oscars');

-- También repara el estado si un intento anterior se interrumpió después de
-- desactivar los triggers y antes de registrar la migración.
alter table public.market_contracts
  enable trigger market_contracts_immutable;
alter table public.market_price_snapshots
  enable trigger market_price_snapshots_immutable;

analyze public.market_price_snapshots;
analyze public.market_contracts;

drop table d034_market_price_snapshots;
drop table d034_market_contracts;
