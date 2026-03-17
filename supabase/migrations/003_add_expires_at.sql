-- pro_membersテーブルにexpires_at（サブスク有効期限）を追加
-- Stripeのcurrent_period_endと同期し、キャンセル後の不正利用を防止
ALTER TABLE pro_members ADD COLUMN IF NOT EXISTS expires_at timestamptz;
