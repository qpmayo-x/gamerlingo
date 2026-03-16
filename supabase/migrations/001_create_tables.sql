-- ユーザーの使用量を追跡するテーブル
create table if not exists usage_tracking (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  date date not null default current_date,
  count integer not null default 0,
  is_pro boolean not null default false,
  stripe_customer_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(device_id, date)
);

-- デバイスIDで高速検索するためのインデックス
create index if not exists idx_usage_device_date on usage_tracking(device_id, date);

-- Pro会員を管理するテーブル
create table if not exists pro_members (
  id uuid primary key default gen_random_uuid(),
  device_id text unique not null,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'active', -- active, canceled, expired
  created_at timestamptz default now(),
  expires_at timestamptz
);

create index if not exists idx_pro_device on pro_members(device_id);

-- RLSを有効化（セキュリティ）
alter table usage_tracking enable row level security;
alter table pro_members enable row level security;

-- anon keyからのアクセスを許可するポリシー
create policy "Allow anon insert" on usage_tracking for insert to anon with check (true);
create policy "Allow anon select" on usage_tracking for select to anon using (true);
create policy "Allow anon update" on usage_tracking for update to anon using (true);

create policy "Allow anon select pro" on pro_members for select to anon using (true);
