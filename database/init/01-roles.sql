\getenv app_password DB_APP_PASSWORD

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;

SELECT format('CREATE ROLE fisko_app LOGIN PASSWORD %L', :'app_password') \gexec

GRANT authenticated TO fisko_app;