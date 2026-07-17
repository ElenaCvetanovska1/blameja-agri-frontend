-- ─────────────────────────────────────────────────────────────────────────────
-- mk_search_norm(text) — Latin ↔ Cyrillic script-agnostic search normalization
-- ─────────────────────────────────────────────────────────────────────────────
-- Продуктите се внесени пола на латиница, пола на кирилица. За да пребарувањето
-- работи еднакво без разлика на писмото (пр. „sinstar" == „синстар"), и
-- зачуваниот текст и пребарувањето се сведуваат на заедничка канонска форма
-- (мали кирилични букви).
--
-- Правила:
--   • lower() — mк. кирилица и латиница
--   • латинични диграфи → кирилична буква (најдолги први):
--       dzh/dž → џ · zh → ж · gj → ѓ · kj → ќ · lj → љ · nj → њ · dz → ѕ
--       sh → ш · ch → ч · ts → ц
--   • латинични единечни букви и дијакритици → кирилица (translate)
--
-- IMMUTABLE → може да се индексира (види долу) и е кешабилна.
--
-- Се вика од *ILIKE* пребарувањата по name во:
--   Sales / Receive / Stock / Dispatch / Products controllers.
--   name-match: mk_search_norm(name) LIKE '%' || mk_search_norm(@q) || '%'
--   (plu/barcode остануваат ILIKE — тие се цифри/ASCII, транслитерацијата е ирелевантна)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION mk_search_norm(txt text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $func$
  SELECT translate(
    replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
      lower(coalesce(txt, '')),
      'dzh','џ'),'dž','џ'),'zh','ж'),'gj','ѓ'),'kj','ќ'),'lj','љ'),'nj','њ'),'dz','ѕ'),'sh','ш'),'ch','ч'),'ts','ц'),
    'abvgdezijklmnoprstufhc' || 'čšžćđyq',
    'абвгдезијклмнопрстуфхц' || 'чшжќѓик'
  );
$func$;

-- Опционален индекс за побрзо пребарување со водечки wildcard (%...%).
-- Бара pg_trgm екстензија. Вклучи го ако инвентарот порасне и seq-scan забави:
--
--   CREATE EXTENSION IF NOT EXISTS pg_trgm;
--   CREATE INDEX IF NOT EXISTS ix_products_name_norm_trgm
--     ON products USING gin (mk_search_norm(name) gin_trgm_ops);
