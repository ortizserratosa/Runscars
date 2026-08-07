update public.market_connectors
set
  extractor_version = 'kalshi-v2',
  configuration = '{
    "ceremony_year": 2027,
    "season_id": "oscars-2027",
    "series_tickers": [
      "KXOSCARNOMPIC", "KXOSCARPIC",
      "KXOSCARNOMDIR", "KXOSCARDIR",
      "KXOSCARNOMACTO", "KXOSCARACTO",
      "KXOSCARNOMACTR", "KXOSCARACTR",
      "KXOSCARNOMSUPACTO", "KXOSCARSUPACTO",
      "KXOSCARNOMSUPACTR", "KXOSCARSUPACTR",
      "KXOSCARNOMSPLAY", "KXOSCARSPLAY",
      "KXOSCARNOMASPLAY", "KXOSCARASPLAY"
    ]
  }'::jsonb
where id = 'kalshi-oscars';

update public.market_connectors
set
  extractor_version = 'polymarket-v2',
  configuration = '{
    "ceremony_year": 2027,
    "query": "Oscars 2027",
    "season_id": "oscars-2027"
  }'::jsonb
where id = 'polymarket-oscars';
