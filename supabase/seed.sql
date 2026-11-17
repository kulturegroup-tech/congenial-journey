-- Starting data. Everything here is editable in the app afterwards.

-- Firm details from the engagement letter and the last invoice (PS-13-26).
-- GSTIN and bank details are entered on the Settings screen, not committed to the repo.
insert into settings (id, firm_name, address, home_state_code, invoice_prefix, next_invoice_serial, gst_rate, sac_code)
values (true, 'Paradigm Shifters',
        '1101, Daffodils, Sector 09, Ulwe, Navi Mumbai, Raigad, Maharashtra 400614',
        '27', 'PS', 14, 18, '9985')
on conflict (id) do nothing;

insert into exit_reasons (code, label, sort) values
  ('not_a_fit',                  'Not a fit for this mandate',          10),
  ('rejected_role',              'Candidate rejected the role',         20),
  ('asked_for_time',             'Asked for time (parked)',             30),
  ('no_response',                'No response',                         40),
  ('duplicate',                  'Duplicate for this client',           50),
  ('client_rejected_cv',         'Client rejected at CV review',        60),
  ('client_rejected_interview',  'Client rejected after interview',     70),
  ('client_rejected_assignment', 'Client rejected after assignment',    80),
  ('client_rejected_final',      'Client rejected after final round',   90),
  ('offer_declined',             'Candidate declined the offer',       100),
  ('backed_out',                 'Backed out before joining',          110),
  ('left_after_joining',         'Left after joining',                 120),
  ('mandate_closed',             'Mandate closed',                     130)
on conflict (code) do nothing;

-- Practice areas: the list (99 areas in groups, with the short forms used in Odoo as aliases) is in
-- migration 20261117000010_notes_and_practice_areas.sql, so it reaches existing databases too.
