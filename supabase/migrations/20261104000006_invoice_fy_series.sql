-- Invoice numbers restart every financial year (April to March), as Khyati asked: PS/2026-27/014.
-- settings.invoice_fy records which year next_invoice_serial belongs to; the first invoice dated in
-- a new financial year starts again at 1.

alter table settings add column invoice_fy text;

-- '2026-27' for any date from 01 Apr 2026 to 31 Mar 2027.
create function financial_year(p_date date) returns text
language sql immutable as $$
  select format('%s-%s', y, lpad(((y + 1) % 100)::text, 2, '0'))
  from (select extract(year from p_date)::int - case when extract(month from p_date) < 4 then 1 else 0 end as y) s
$$;

-- The serial already in settings continues this financial year's series.
update settings set invoice_fy = financial_year(today_ist()) where invoice_fy is null;

create or replace function create_invoice(p_placement uuid, p_invoice_date date default null) returns invoices
language plpgsql security definer set search_path = public as $$
declare
  p        placements;
  cl       clients;
  a        agreements;
  s        settings;
  inv      invoices;
  v_date   date := coalesce(p_invoice_date, today_ist());
  v_fy     text := financial_year(coalesce(p_invoice_date, today_ist()));
  v_serial int;
  v_tax    tax_type;
  v_cgst   numeric(12,2) := 0;
  v_sgst   numeric(12,2) := 0;
  v_igst   numeric(12,2) := 0;
begin
  if auth.uid() is not null and not is_team_member() then raise exception 'Not allowed'; end if;
  select * into p from placements where id = p_placement;
  if not found then raise exception 'Placement not found'; end if;
  if p.status not in ('joined', 'left_in_window', 'completed') then
    raise exception 'Invoice only after the candidate joins (status: %)', p.status;
  end if;
  if coalesce(p.fee_amount, 0) <= 0 then raise exception 'No fee on this placement; check the fee %%'; end if;
  if exists (select 1 from invoices where placement_id = p.id and status <> 'cancelled') then
    raise exception 'This placement already has an invoice';
  end if;
  select * into cl from clients where id = p.client_id;
  if cl.gstin is null then raise exception 'Add the client''s GSTIN before invoicing'; end if;
  select * into a from agreements where id = p.agreement_id;
  select * into s from settings for update;

  if s.invoice_fy is not null and v_fy < s.invoice_fy then
    raise exception 'The invoice date falls in financial year %, but the series has moved on to %', v_fy, s.invoice_fy;
  end if;
  -- No year recorded yet means the serial in settings is the one to continue.
  v_serial := case when s.invoice_fy is not null and s.invoice_fy <> v_fy then 1 else s.next_invoice_serial end;

  v_tax := case when cl.state_code = s.home_state_code then 'cgst_sgst' else 'igst' end::tax_type;
  if v_tax = 'cgst_sgst' then
    v_cgst := round(p.fee_amount * s.gst_rate / 200, 2);
    v_sgst := v_cgst;
  else
    v_igst := round(p.fee_amount * s.gst_rate / 100, 2);
  end if;

  insert into invoices (invoice_number, placement_id, client_id, invoice_date, taxable_amount, tax, gst_rate,
                        cgst, sgst, igst, total, raise_by, due_on)
  values (format('%s/%s/%s', s.invoice_prefix, v_fy, lpad(v_serial::text, 3, '0')),
          p.id, p.client_id, v_date, p.fee_amount, v_tax, s.gst_rate, v_cgst, v_sgst, v_igst,
          p.fee_amount + v_cgst + v_sgst + v_igst,
          case when a.invoice_deadline_days is not null then p.joining_date + a.invoice_deadline_days end,
          case when a.payment_from = 'joining_date' then p.joining_date + coalesce(a.payment_days, 15)
               else v_date + coalesce(a.payment_days, 15) end)
  returning * into inv;

  update settings set next_invoice_serial = v_serial + 1, invoice_fy = v_fy, updated_at = now();
  return inv;
end $$;
