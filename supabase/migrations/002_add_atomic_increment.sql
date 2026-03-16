-- 使用量を原子的にインクリメントするRPC関数
-- レースコンディション防止: 同時リクエストでも正確にカウントする
create or replace function increment_usage(
  p_device_id text,
  p_date date,
  p_limit integer
)
returns jsonb
language plpgsql
as $$
declare
  v_new_count integer;
begin
  -- UPSERT + 原子的インクリメント
  insert into usage_tracking (device_id, date, count, is_pro)
  values (p_device_id, p_date, 1, false)
  on conflict (device_id, date)
  do update set count = usage_tracking.count + 1, updated_at = now()
  returning count into v_new_count;

  -- 制限チェック（インクリメント後）
  if v_new_count > p_limit then
    -- 制限超過: カウントを戻す
    update usage_tracking
    set count = count - 1
    where device_id = p_device_id and date = p_date;

    return jsonb_build_object(
      'limit_reached', true,
      'new_count', v_new_count - 1
    );
  end if;

  return jsonb_build_object(
    'limit_reached', false,
    'new_count', v_new_count
  );
end;
$$;

-- service_role と anon の両方からRPC呼び出しを許可
grant execute on function increment_usage(text, date, integer) to anon;
grant execute on function increment_usage(text, date, integer) to service_role;
