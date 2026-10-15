create table if not exists portfolio_vault (
  code_hash text primary key,
  payload text not null,
  updated_at timestamptz not null default now()
);
