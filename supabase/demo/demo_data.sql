-- =====================================================================
-- FICTIONAL DEMO DATA. Every person, phone number and email here is made up.
-- Firm names are real law firms, used only so the demo feels familiar.
-- Every demo row's id starts with 'de000000-' so remove_demo_data.sql can delete exactly these rows.
-- Run once in the Supabase SQL editor (or via the MCP). Re-running is a no-op if the data is there.
-- =====================================================================
do $$
begin
  if exists (select 1 from candidates where id = 'de000000-0000-4000-8000-000000000501') then
    raise notice 'Demo data already loaded';
    return;
  end if;

  -- ---------- Demo recruiters (no passwords: they cannot sign in) ----------
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, email_change, email_change_token_new, recovery_token)
  values
    ('00000000-0000-0000-0000-000000000000', 'de000000-0000-4000-8000-000000000101', 'authenticated', 'authenticated',
     'khyati.demo@example.com', '', null, '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', 'de000000-0000-4000-8000-000000000102', 'authenticated', 'authenticated',
     'kopal.demo@example.com', '', null, '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', 'de000000-0000-4000-8000-000000000103', 'authenticated', 'authenticated',
     'harshit.demo@example.com', '', null, '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

  insert into team_members (id, full_name, email, is_admin) values
    ('de000000-0000-4000-8000-000000000101', 'Khyati (demo)',  'khyati.demo@example.com',  false),
    ('de000000-0000-4000-8000-000000000102', 'Kopal (demo)',   'kopal.demo@example.com',   false),
    ('de000000-0000-4000-8000-000000000103', 'Harshit (demo)', 'harshit.demo@example.com', false);

  -- ---------- Firms ----------
  insert into firms (id, name, aliases) values
    ('de000000-0000-4000-8000-000000000201', 'AZB & Partners', '{AZB}'),
    ('de000000-0000-4000-8000-000000000202', 'Cyril Amarchand Mangaldas', '{CAM}'),
    ('de000000-0000-4000-8000-000000000203', 'Shardul Amarchand Mangaldas & Co', '{SAM}'),
    ('de000000-0000-4000-8000-000000000204', 'Khaitan & Co', '{Khaitan,KCo}'),
    ('de000000-0000-4000-8000-000000000205', 'JSA Advocates & Solicitors', '{JSA}'),
    ('de000000-0000-4000-8000-000000000206', 'Trilegal', '{}'),
    ('de000000-0000-4000-8000-000000000207', 'Argus Partners', '{Argus}'),
    ('de000000-0000-4000-8000-000000000208', 'IndusLaw', '{Indus}'),
    ('de000000-0000-4000-8000-000000000209', 'Saraf and Partners', '{Saraf}'),
    ('de000000-0000-4000-8000-000000000210', 'Bharucha & Partners', '{Bharucha}'),
    ('de000000-0000-4000-8000-000000000211', 'Phoenix Legal', '{}'),
    ('de000000-0000-4000-8000-000000000212', 'Ikigai Law', '{Ikigai}'),
    ('de000000-0000-4000-8000-000000000213', 'Lakshmikumaran & Sridharan', '{L&S,LKS}'),
    ('de000000-0000-4000-8000-000000000214', 'Spice Route Legal', '{}');

  -- ---------- Clients and agreements (fictional GSTINs) ----------
  insert into clients (id, firm_id, display_name, gstin, owner_id) values
    ('de000000-0000-4000-8000-000000000301', 'de000000-0000-4000-8000-000000000205', 'JSA',            '27AAAAA0000A1Z1', 'de000000-0000-4000-8000-000000000101'),
    ('de000000-0000-4000-8000-000000000302', 'de000000-0000-4000-8000-000000000206', 'Trilegal',       '27AAAAA0000A1Z2', 'de000000-0000-4000-8000-000000000101'),
    ('de000000-0000-4000-8000-000000000303', 'de000000-0000-4000-8000-000000000207', 'Argus Partners', '27AAAAA0000A1Z3', 'de000000-0000-4000-8000-000000000101'),
    ('de000000-0000-4000-8000-000000000304', 'de000000-0000-4000-8000-000000000204', 'Khaitan & Co',   '29AAAAA0000A1Z4', 'de000000-0000-4000-8000-000000000102'),
    ('de000000-0000-4000-8000-000000000305', 'de000000-0000-4000-8000-000000000212', 'Ikigai Law',     '07AAAAA0000A1Z5', 'de000000-0000-4000-8000-000000000103');

  insert into agreements (id, client_id, title, starts_on, ends_on, cooling_off_months, resume_validity_months,
                          replacement_days, replacement_excludes_medical, invoice_deadline_days, payment_days,
                          payment_from, requires_portal, portal_name, copy_ta_on_partner_shares) values
    ('de000000-0000-4000-8000-000000000401', 'de000000-0000-4000-8000-000000000301', 'Letter of Engagement', '2026-01-01', null,         6, 12, 90, true,  null, 15, 'invoice_date', false, null, false),
    ('de000000-0000-4000-8000-000000000402', 'de000000-0000-4000-8000-000000000302', 'Recruitment Services Agreement FY 2026-27', '2026-05-20', '2027-03-31', 6, 12, 90, false, 30, 60, 'joining_date', true, 'SAP SuccessFactors', true),
    ('de000000-0000-4000-8000-000000000403', 'de000000-0000-4000-8000-000000000303', 'Letter of Engagement', '2025-12-01', null,         6, 12, 90, true,  null, 15, 'invoice_date', false, null, false),
    ('de000000-0000-4000-8000-000000000404', 'de000000-0000-4000-8000-000000000304', 'Letter of Engagement', '2026-03-01', null,         6, 12, 90, true,  null, 30, 'invoice_date', false, null, false),
    ('de000000-0000-4000-8000-000000000405', 'de000000-0000-4000-8000-000000000305', 'Letter of Engagement', '2026-02-01', null,         6, 12, 90, true,  null, 15, 'invoice_date', false, null, false);

  insert into agreement_fee_rates (agreement_id, role_category, fee_percent) values
    ('de000000-0000-4000-8000-000000000401', 'legal', 10),
    ('de000000-0000-4000-8000-000000000402', 'legal', 10),
    ('de000000-0000-4000-8000-000000000402', 'support_staff', 9),
    ('de000000-0000-4000-8000-000000000403', 'legal', 10),
    ('de000000-0000-4000-8000-000000000404', 'legal', 10),
    ('de000000-0000-4000-8000-000000000405', 'legal', 13);

  -- ---------- Candidates (all fictional) ----------
  insert into candidates (id, full_name, linkedin_url, current_firm_id, designation, practice_areas, practice_start_date,
                          current_city, preferred_cities, source, owner_id, review_note) values
    ('de000000-0000-4000-8000-000000000501', 'Ananya Rao',       'https://www.linkedin.com/in/demo-ananya-rao',       'de000000-0000-4000-8000-000000000201', 'Associate',        '{TMT}',                      (today_ist() - interval '3 years 2 months')::date,  'Bengaluru', '{Bengaluru}', 'linkedin_outreach', 'de000000-0000-4000-8000-000000000101', 'Demo data'),
    ('de000000-0000-4000-8000-000000000502', 'Rohan Mehta',      'https://www.linkedin.com/in/demo-rohan-mehta',      'de000000-0000-4000-8000-000000000202', 'Associate',        '{M&A}',                      (today_ist() - interval '4 years 1 month')::date,   'Bengaluru', '{Bengaluru,Mumbai}', 'linkedin_outreach', 'de000000-0000-4000-8000-000000000102', 'Demo data'),
    ('de000000-0000-4000-8000-000000000503', 'Ishita Kapoor',    'https://www.linkedin.com/in/demo-ishita-kapoor',    'de000000-0000-4000-8000-000000000208', 'Associate',        '{TMT}',                      (today_ist() - interval '2 years 7 months')::date,  'Bengaluru', '{}', 'linkedin_outreach', 'de000000-0000-4000-8000-000000000101', 'Demo data'),
    ('de000000-0000-4000-8000-000000000504', 'Kabir Malhotra',   'https://www.linkedin.com/in/demo-kabir-malhotra',   'de000000-0000-4000-8000-000000000209', 'Associate',        '{TMT}',                      (today_ist() - interval '3 years 10 months')::date, 'Bengaluru', '{}', 'inbound',           'de000000-0000-4000-8000-000000000101', 'Demo data'),
    ('de000000-0000-4000-8000-000000000505', 'Meera Iyer',       'https://www.linkedin.com/in/demo-meera-iyer',       'de000000-0000-4000-8000-000000000214', 'Associate',        '{"Data Protection",TMT}',    (today_ist() - interval '2 years 1 month')::date,   'Bengaluru', '{}', 'linkedin_outreach', 'de000000-0000-4000-8000-000000000101', 'Demo data'),
    ('de000000-0000-4000-8000-000000000506', 'Arjun Nair',       'https://www.linkedin.com/in/demo-arjun-nair',       'de000000-0000-4000-8000-000000000211', 'Senior Associate', '{"Banking & Finance"}',      (today_ist() - interval '4 years')::date,           'Mumbai',    '{}', 'referral',          'de000000-0000-4000-8000-000000000102', 'Demo data'),
    ('de000000-0000-4000-8000-000000000507', 'Sneha Kulkarni',   'https://www.linkedin.com/in/demo-sneha-kulkarni',   'de000000-0000-4000-8000-000000000210', 'Associate',        '{"Banking & Finance"}',      (today_ist() - interval '3 years 4 months')::date,  'Mumbai',    '{}', 'linkedin_outreach', 'de000000-0000-4000-8000-000000000102', 'Demo data'),
    ('de000000-0000-4000-8000-000000000508', 'Vikram Joshi',     'https://www.linkedin.com/in/demo-vikram-joshi',     'de000000-0000-4000-8000-000000000201', 'Senior Associate', '{"Banking & Finance"}',      (today_ist() - interval '5 years 2 months')::date,  'Mumbai',    '{}', 'linkedin_outreach', 'de000000-0000-4000-8000-000000000102', 'Demo data'),
    ('de000000-0000-4000-8000-000000000509', 'Pooja Desai',      'https://www.linkedin.com/in/demo-pooja-desai',      'de000000-0000-4000-8000-000000000203', 'Associate',        '{"Banking & Finance"}',      (today_ist() - interval '3 years')::date,           'Mumbai',    '{}', 'linkedin_outreach', 'de000000-0000-4000-8000-000000000102', 'Demo data'),
    ('de000000-0000-4000-8000-000000000510', 'Nikhil Bansal',    'https://www.linkedin.com/in/demo-nikhil-bansal',    'de000000-0000-4000-8000-000000000204', 'Senior Associate', '{"General Corporate"}',      (today_ist() - interval '6 years 5 months')::date,  'Mumbai',    '{}', 'linkedin_outreach', 'de000000-0000-4000-8000-000000000101', 'Demo data'),
    ('de000000-0000-4000-8000-000000000511', 'Tanvi Shah',       'https://www.linkedin.com/in/demo-tanvi-shah',       'de000000-0000-4000-8000-000000000202', 'Senior Associate', '{"General Corporate",M&A}',  (today_ist() - interval '7 years 1 month')::date,   'Mumbai',    '{}', 'referral',          'de000000-0000-4000-8000-000000000101', 'Demo data'),
    ('de000000-0000-4000-8000-000000000512', 'Aditya Rao',       'https://www.linkedin.com/in/demo-aditya-rao',       'de000000-0000-4000-8000-000000000213', 'Senior Associate', '{"General Corporate"}',      (today_ist() - interval '5 years 10 months')::date, 'Mumbai',    '{}', 'linkedin_outreach', 'de000000-0000-4000-8000-000000000101', 'Demo data'),
    ('de000000-0000-4000-8000-000000000513', 'Riya Sen',         'https://www.linkedin.com/in/demo-riya-sen',         'de000000-0000-4000-8000-000000000206', 'Associate',        '{"Data Protection"}',        (today_ist() - interval '1 year 10 months')::date,  'Delhi',     '{}', 'inbound',           'de000000-0000-4000-8000-000000000103', 'Demo data'),
    ('de000000-0000-4000-8000-000000000514', 'Karan Sethi',      'https://www.linkedin.com/in/demo-karan-sethi',      'de000000-0000-4000-8000-000000000209', 'Associate',        '{TMT}',                      (today_ist() - interval '4 years 5 months')::date,  'Delhi',     '{}', 'linkedin_outreach', 'de000000-0000-4000-8000-000000000103', 'Demo data'),
    ('de000000-0000-4000-8000-000000000515', 'Divya Menon',      'https://www.linkedin.com/in/demo-divya-menon',      'de000000-0000-4000-8000-000000000214', 'Associate',        '{TMT,"Data Protection"}',    (today_ist() - interval '2 years 11 months')::date, 'Delhi',     '{}', 'linkedin_outreach', 'de000000-0000-4000-8000-000000000103', 'Demo data'),
    ('de000000-0000-4000-8000-000000000516', 'Siddharth Verma',  'https://www.linkedin.com/in/demo-siddharth-verma',  'de000000-0000-4000-8000-000000000205', 'Associate',        '{Disputes}',                 (today_ist() - interval '3 years 7 months')::date,  'Delhi',     '{}', 'linkedin_outreach', 'de000000-0000-4000-8000-000000000103', 'Demo data'),
    ('de000000-0000-4000-8000-000000000517', 'Neha Agarwal',     'https://www.linkedin.com/in/demo-neha-agarwal',     'de000000-0000-4000-8000-000000000211', 'Associate',        '{"Real Estate"}',            (today_ist() - interval '4 years 2 months')::date,  'Mumbai',    '{}', 'linkedin_outreach', 'de000000-0000-4000-8000-000000000102', 'Demo data'),
    ('de000000-0000-4000-8000-000000000518', 'Rahul Khanna',     'https://www.linkedin.com/in/demo-rahul-khanna',     'de000000-0000-4000-8000-000000000208', 'Associate',        '{"Real Estate"}',            (today_ist() - interval '3 years 1 month')::date,   'Mumbai',    '{}', 'linkedin_outreach', 'de000000-0000-4000-8000-000000000102', 'Demo data'),
    ('de000000-0000-4000-8000-000000000519', 'Aisha Qureshi',    'https://www.linkedin.com/in/demo-aisha-qureshi',    'de000000-0000-4000-8000-000000000201', 'Associate',        '{M&A}',                      (today_ist() - interval '4 years 7 months')::date,  'Bengaluru', '{Bengaluru}', 'inbound', 'de000000-0000-4000-8000-000000000103', 'Demo data'),
    ('de000000-0000-4000-8000-000000000520', 'Gaurav Pillai',    'https://www.linkedin.com/in/demo-gaurav-pillai',    'de000000-0000-4000-8000-000000000202', 'Associate',        '{M&A}',                      (today_ist() - interval '3 years 5 months')::date,  'Bengaluru', '{}', 'linkedin_outreach', 'de000000-0000-4000-8000-000000000102', 'Demo data'),
    ('de000000-0000-4000-8000-000000000521', 'Kavya Reddy',      'https://www.linkedin.com/in/demo-kavya-reddy',      'de000000-0000-4000-8000-000000000206', 'Senior Associate', '{"Banking & Finance"}',      (today_ist() - interval '5 years')::date,           'Mumbai',    '{}', 'linkedin_outreach', 'de000000-0000-4000-8000-000000000102', 'Demo data'),
    ('de000000-0000-4000-8000-000000000522', 'Manish Gupta',     'https://www.linkedin.com/in/demo-manish-gupta',     'de000000-0000-4000-8000-000000000207', 'Senior Associate', '{"General Corporate"}',      (today_ist() - interval '6 years')::date,           'Mumbai',    '{}', 'referral',          'de000000-0000-4000-8000-000000000101', 'Demo data'),
    ('de000000-0000-4000-8000-000000000523', 'Shruti Bhat',      'https://www.linkedin.com/in/demo-shruti-bhat',      'de000000-0000-4000-8000-000000000204', 'Associate',        '{Funds}',                    (today_ist() - interval '2 years 5 months')::date,  'Mumbai',    '{}', 'linkedin_outreach', 'de000000-0000-4000-8000-000000000102', 'Demo data'),
    ('de000000-0000-4000-8000-000000000524', 'Aman Choudhary',   'https://www.linkedin.com/in/demo-aman-choudhary',   'de000000-0000-4000-8000-000000000213', 'Associate',        '{Tax}',                      (today_ist() - interval '3 years 11 months')::date, 'Delhi',     '{}', 'linkedin_outreach', 'de000000-0000-4000-8000-000000000103', 'Demo data'),
    ('de000000-0000-4000-8000-000000000525', 'Tara Dsouza',      'https://www.linkedin.com/in/demo-tara-dsouza',      'de000000-0000-4000-8000-000000000208', 'Associate',        '{Employment}',               (today_ist() - interval '2 years 2 months')::date,  'Bengaluru', '{}', 'referral',          'de000000-0000-4000-8000-000000000101', 'Demo data'),
    ('de000000-0000-4000-8000-000000000526', 'Yash Agrawal',     'https://www.linkedin.com/in/demo-yash-agrawal',     'de000000-0000-4000-8000-000000000210', 'Senior Associate', '{"Capital Markets"}',        (today_ist() - interval '4 years 10 months')::date, 'Mumbai',    '{}', 'linkedin_outreach', 'de000000-0000-4000-8000-000000000102', 'Demo data'),
    ('de000000-0000-4000-8000-000000000527', 'Prerna Jain',      'https://www.linkedin.com/in/demo-prerna-jain',      'de000000-0000-4000-8000-000000000214', 'Associate',        '{TMT}',                      (today_ist() - interval '1 year 2 months')::date,   'Bengaluru', '{}', 'linkedin_outreach', 'de000000-0000-4000-8000-000000000101', 'Demo data'),
    ('de000000-0000-4000-8000-000000000528', 'Harsh Vardhan',    'https://www.linkedin.com/in/demo-harsh-vardhan',    'de000000-0000-4000-8000-000000000209', 'Senior Associate', '{PE/VC}',                    (today_ist() - interval '5 years 6 months')::date,  'Mumbai',    '{}', 'inbound',           'de000000-0000-4000-8000-000000000102', 'Demo data');

  -- Phones in the reserved-looking 90000 1xxxx range; a few people have no number yet (the Weekday story).
  insert into candidate_phones (candidate_id, phone, source, is_primary)
  select ('de000000-0000-4000-8000-000000000' || n)::uuid, '+9190000' || (10000 + n)::text, 'manual', true
  from generate_series(501, 528) n
  where n not in (512, 518, 527);
  insert into candidate_phones (candidate_id, phone, source) values
    ('de000000-0000-4000-8000-000000000501', '+919000020501', 'weekday'),
    ('de000000-0000-4000-8000-000000000510', '+919000020510', 'weekday');

  insert into candidate_emails (candidate_id, email, is_primary)
  select c.id, replace(lower(c.full_name), ' ', '.') || '@example.com', true
  from candidates c where c.id::text like 'de000000-%' and c.id::text <> 'de000000-0000-4000-8000-000000000512';

  -- ---------- Screening calls ----------
  insert into screening_calls (id, candidate_id, recruiter_id, status, called_at, education, work_history, nature_of_work,
                               industries_clients, looking_for, team_experience, non_negotiables, current_city,
                               notice_period_days, current_ctc, expected_ctc, applications_made, discussion, action_points, outcome) values
    ('de000000-0000-4000-8000-000000000801', 'de000000-0000-4000-8000-000000000501', 'de000000-0000-4000-8000-000000000101', 'done', now() - interval '95 days',
     'B.A. LL.B. (Hons.), 2023; certificate in data privacy', 'AZB Bengaluru since 2023, reports to a TMT partner; first job',
     'Tech transactions, SaaS contracts, data protection advisory', 'Fintech, SaaS', 'Khaitan Bengaluru, TMT. Open to other top firms in Bengaluru only',
     'Lean team, long hours, good partner access', 'Stay in Bengaluru', 'Bengaluru', 60, 2400000, 3000000, 'None',
     'Strong profile. Spoke for the older JSA mandate; she wants Khaitan specifically.', 'Re-engage when Khaitan Bengaluru opens a TMT or M&A role', 'not_fit'),
    ('de000000-0000-4000-8000-000000000802', 'de000000-0000-4000-8000-000000000502', 'de000000-0000-4000-8000-000000000102', 'done', now() - interval '50 days',
     'LL.B., 2022', 'Cyril Amarchand Mangaldas, M&A team, since 2022', 'Domestic M&A, PE exits', 'Healthcare, consumer',
     'Khaitan & Co, M&A', 'Good learning, hierarchy is heavy', 'Title and growth', 'Bengaluru', 90, 2800000, 3500000, 'None',
     'Not looking actively; would move for Khaitan.', 'Call when Khaitan opens', 'not_fit'),
    ('de000000-0000-4000-8000-000000000803', 'de000000-0000-4000-8000-000000000519', 'de000000-0000-4000-8000-000000000103', 'done', now() - interval '20 days',
     'B.B.A. LL.B., 2022', 'AZB Bengaluru, corporate team', 'M&A, joint ventures', 'Manufacturing, infra',
     'Khaitan Bengaluru or a mid-size firm with M&A focus', 'Supportive team', 'Hybrid work', 'Bengaluru', 60, 2600000, 3200000, 'None',
     'Wants to move within 3 months.', 'Follow up when an M&A Bengaluru role opens', 'follow_up'),
    ('de000000-0000-4000-8000-000000000804', 'de000000-0000-4000-8000-000000000504', 'de000000-0000-4000-8000-000000000101', 'done', now() - interval '5 days',
     'LL.B., 2022', 'Saraf and Partners, TMT', 'Tech and telecom regulatory', 'Telecom', 'JSA or Trilegal', 'Fine', 'Compensation',
     'Bengaluru', 30, 2300000, 2900000, 'Applied to JSA via LinkedIn Jobs about six weeks ago', 'Keen on JSA.', 'Check duplicate before sharing', 'fit'),
    ('de000000-0000-4000-8000-000000000805', 'de000000-0000-4000-8000-000000000503', 'de000000-0000-4000-8000-000000000101', 'done', now() - interval '10 days',
     null, null, 'Tech transactions', null, 'JSA TMT', null, null, 'Bengaluru', 60, 2000000, 2600000, 'None', 'Good fit for JSA TMT.', 'Get CV', 'fit'),
    ('de000000-0000-4000-8000-000000000806', 'de000000-0000-4000-8000-000000000506', 'de000000-0000-4000-8000-000000000102', 'done', now() - interval '14 days',
     null, null, 'Lending, project finance', null, 'Trilegal or SAM, banking', null, null, 'Mumbai', 90, 3000000, 3800000, 'None', null, null, 'fit'),
    ('de000000-0000-4000-8000-000000000807', 'de000000-0000-4000-8000-000000000507', 'de000000-0000-4000-8000-000000000102', 'done', now() - interval '9 days',
     null, null, 'Lending', null, 'Tier-1 banking team', null, null, 'Mumbai', 60, 2500000, 3100000, 'None', null, null, 'fit'),
    ('de000000-0000-4000-8000-000000000808', 'de000000-0000-4000-8000-000000000510', 'de000000-0000-4000-8000-000000000101', 'done', now() - interval '18 days',
     null, null, 'General corporate, FDI', null, 'Senior role with client contact', null, null, 'Mumbai', 90, 4200000, 5200000, 'None', null, null, 'fit'),
    ('de000000-0000-4000-8000-000000000809', 'de000000-0000-4000-8000-000000000511', 'de000000-0000-4000-8000-000000000101', 'done', now() - interval '11 days',
     null, null, 'General corporate', null, 'Argus or similar', null, null, 'Mumbai', 90, 4600000, 5500000, 'None', null, null, 'fit'),
    ('de000000-0000-4000-8000-000000000810', 'de000000-0000-4000-8000-000000000514', 'de000000-0000-4000-8000-000000000103', 'done', now() - interval '6 days',
     null, null, 'Tech policy, data protection', null, 'Ikigai Law', null, null, 'Delhi', 30, 2600000, 3200000, 'None', null, null, 'fit'),
    ('de000000-0000-4000-8000-000000000811', 'de000000-0000-4000-8000-000000000513', 'de000000-0000-4000-8000-000000000103', 'done', now() - interval '3 days',
     null, null, 'Data protection', null, 'Ikigai Law', null, null, 'Delhi', 30, 1500000, 1900000, 'None', null, null, 'fit'),
    ('de000000-0000-4000-8000-000000000812', 'de000000-0000-4000-8000-000000000516', 'de000000-0000-4000-8000-000000000103', 'done', now() - interval '25 days',
     null, null, 'Commercial litigation', null, 'Disputes, Delhi', null, null, 'Delhi', 60, 2200000, 2700000, 'None', null, null, 'fit');

  -- Calls booked for today and tomorrow (they show under Reminders on the day)
  insert into screening_calls (id, candidate_id, recruiter_id, status, scheduled_for) values
    ('de000000-0000-4000-8000-000000000821', 'de000000-0000-4000-8000-000000000515', 'de000000-0000-4000-8000-000000000103', 'scheduled',
     (today_ist() + time '21:30') at time zone 'Asia/Kolkata'),
    ('de000000-0000-4000-8000-000000000822', 'de000000-0000-4000-8000-000000000505', 'de000000-0000-4000-8000-000000000101', 'scheduled',
     (today_ist() + 1 + time '11:00') at time zone 'Asia/Kolkata');

  -- What candidates said they want (field 5) and where their CV already went (field 12)
  insert into interest_tags (candidate_id, firm_id, city, practice_area, not_taken_reason, screening_call_id) values
    ('de000000-0000-4000-8000-000000000501', 'de000000-0000-4000-8000-000000000204', 'Bengaluru', 'TMT', 'Only wants Khaitan Bengaluru; no mandate there at the time', 'de000000-0000-4000-8000-000000000801'),
    ('de000000-0000-4000-8000-000000000502', 'de000000-0000-4000-8000-000000000204', null, 'M&A', 'Would move only for Khaitan', 'de000000-0000-4000-8000-000000000802'),
    ('de000000-0000-4000-8000-000000000519', 'de000000-0000-4000-8000-000000000204', 'Bengaluru', 'M&A', 'No M&A role in Bengaluru then', 'de000000-0000-4000-8000-000000000803');
  insert into prior_applications (candidate_id, firm_id, route, applied_on, details) values
    ('de000000-0000-4000-8000-000000000504', 'de000000-0000-4000-8000-000000000205', 'job_portal', today_ist() - 40, 'LinkedIn Jobs');

  -- ---------- Mandates ----------
  -- Re-engagement alerts are sent after the pipelines are filled, so people already in a pipeline aren't flagged.
  alter table mandates disable trigger mandates_open_after;
  insert into mandates (id, client_id, title, practice_area, pqe_min, pqe_max, grade_label, city, owner_id, status, received_on,
                        team_size, soft_points, pain_points) values
    ('de000000-0000-4000-8000-000000000601', 'de000000-0000-4000-8000-000000000301', 'TMT associate', 'TMT', 2, 4, null, 'Bengaluru',
     'de000000-0000-4000-8000-000000000101', 'active', today_ist() - 12, '8 lawyers, 2 partners', 'Drafts independently; comfortable on client calls', 'Two associates left this year'),
    ('de000000-0000-4000-8000-000000000602', 'de000000-0000-4000-8000-000000000302', 'Banking & Finance associate', 'Banking & Finance', 3, 5, null, 'Mumbai',
     'de000000-0000-4000-8000-000000000102', 'active', today_ist() - 20, '12 lawyers', 'Lender-side experience', null),
    ('de000000-0000-4000-8000-000000000603', 'de000000-0000-4000-8000-000000000303', 'General Corporate senior associate', 'General Corporate', 5, 8, 'SA1–SA2', 'Mumbai',
     'de000000-0000-4000-8000-000000000101', 'active', today_ist() - 30, null, 'Can lead deals with light partner supervision', null),
    ('de000000-0000-4000-8000-000000000604', 'de000000-0000-4000-8000-000000000305', 'Technology & data protection associate', 'Data Protection', 1, 6, 'A1–SA1', 'Delhi',
     'de000000-0000-4000-8000-000000000103', 'active', today_ist() - 9, null, 'Policy writing', null),
    ('de000000-0000-4000-8000-000000000605', 'de000000-0000-4000-8000-000000000302', 'Disputes associate', 'Disputes', 2, 5, null, 'Delhi',
     'de000000-0000-4000-8000-000000000103', 'on_hold', today_ist() - 40, null, null, 'Hiring paused until January'),
    ('de000000-0000-4000-8000-000000000606', 'de000000-0000-4000-8000-000000000303', 'Real estate associate', 'Real Estate', 3, 6, null, 'Mumbai',
     'de000000-0000-4000-8000-000000000102', 'active', today_ist() - 25, null, null, null),
    ('de000000-0000-4000-8000-000000000607', 'de000000-0000-4000-8000-000000000302', 'Banking associate', 'Banking & Finance', 4, 6, null, 'Mumbai',
     'de000000-0000-4000-8000-000000000102', 'filled', today_ist() - 70, null, null, null),
    ('de000000-0000-4000-8000-000000000608', 'de000000-0000-4000-8000-000000000303', 'General Corporate associate', 'General Corporate', 5, 7, null, 'Mumbai',
     'de000000-0000-4000-8000-000000000101', 'filled', today_ist() - 140, null, null, null);

  -- ---------- Pipelines ----------
  insert into pipeline_entries (id, candidate_id, mandate_id, stage, owner_id) values
    ('de000000-0000-4000-8000-000000000701', 'de000000-0000-4000-8000-000000000503', 'de000000-0000-4000-8000-000000000601', 'confirmed', 'de000000-0000-4000-8000-000000000101'),
    ('de000000-0000-4000-8000-000000000702', 'de000000-0000-4000-8000-000000000504', 'de000000-0000-4000-8000-000000000601', 'confirmed', 'de000000-0000-4000-8000-000000000101'),
    ('de000000-0000-4000-8000-000000000703', 'de000000-0000-4000-8000-000000000505', 'de000000-0000-4000-8000-000000000601', 'pitched',   'de000000-0000-4000-8000-000000000101'),
    ('de000000-0000-4000-8000-000000000704', 'de000000-0000-4000-8000-000000000527', 'de000000-0000-4000-8000-000000000601', 'mapped',    'de000000-0000-4000-8000-000000000101'),
    ('de000000-0000-4000-8000-000000000705', 'de000000-0000-4000-8000-000000000506', 'de000000-0000-4000-8000-000000000602', 'confirmed', 'de000000-0000-4000-8000-000000000102'),
    ('de000000-0000-4000-8000-000000000706', 'de000000-0000-4000-8000-000000000507', 'de000000-0000-4000-8000-000000000602', 'confirmed', 'de000000-0000-4000-8000-000000000102'),
    ('de000000-0000-4000-8000-000000000707', 'de000000-0000-4000-8000-000000000508', 'de000000-0000-4000-8000-000000000602', 'pitched',   'de000000-0000-4000-8000-000000000102'),
    ('de000000-0000-4000-8000-000000000708', 'de000000-0000-4000-8000-000000000509', 'de000000-0000-4000-8000-000000000602', 'pitched',   'de000000-0000-4000-8000-000000000102'),
    ('de000000-0000-4000-8000-000000000709', 'de000000-0000-4000-8000-000000000510', 'de000000-0000-4000-8000-000000000603', 'confirmed', 'de000000-0000-4000-8000-000000000101'),
    ('de000000-0000-4000-8000-000000000710', 'de000000-0000-4000-8000-000000000511', 'de000000-0000-4000-8000-000000000603', 'called',    'de000000-0000-4000-8000-000000000101'),
    ('de000000-0000-4000-8000-000000000711', 'de000000-0000-4000-8000-000000000512', 'de000000-0000-4000-8000-000000000603', 'mapped',    'de000000-0000-4000-8000-000000000101'),
    ('de000000-0000-4000-8000-000000000712', 'de000000-0000-4000-8000-000000000513', 'de000000-0000-4000-8000-000000000604', 'confirmed', 'de000000-0000-4000-8000-000000000103'),
    ('de000000-0000-4000-8000-000000000713', 'de000000-0000-4000-8000-000000000514', 'de000000-0000-4000-8000-000000000604', 'confirmed', 'de000000-0000-4000-8000-000000000103'),
    ('de000000-0000-4000-8000-000000000714', 'de000000-0000-4000-8000-000000000515', 'de000000-0000-4000-8000-000000000604', 'pitched',   'de000000-0000-4000-8000-000000000103'),
    ('de000000-0000-4000-8000-000000000715', 'de000000-0000-4000-8000-000000000516', 'de000000-0000-4000-8000-000000000605', 'called',    'de000000-0000-4000-8000-000000000103'),
    ('de000000-0000-4000-8000-000000000716', 'de000000-0000-4000-8000-000000000517', 'de000000-0000-4000-8000-000000000606', 'pitched',   'de000000-0000-4000-8000-000000000102'),
    ('de000000-0000-4000-8000-000000000717', 'de000000-0000-4000-8000-000000000518', 'de000000-0000-4000-8000-000000000606', 'mapped',    'de000000-0000-4000-8000-000000000102'),
    ('de000000-0000-4000-8000-000000000718', 'de000000-0000-4000-8000-000000000521', 'de000000-0000-4000-8000-000000000607', 'confirmed', 'de000000-0000-4000-8000-000000000102'),
    ('de000000-0000-4000-8000-000000000719', 'de000000-0000-4000-8000-000000000522', 'de000000-0000-4000-8000-000000000608', 'confirmed', 'de000000-0000-4000-8000-000000000101');

  -- Exits: one turned the role down, one asked for time (follow-up due today)
  update pipeline_entries set exit_reason = 'rejected_role', exit_note = 'Not moving before bonus in April'
  where id = 'de000000-0000-4000-8000-000000000707';
  update pipeline_entries set exit_reason = 'asked_for_time', exit_note = 'Discussing with family', follow_up_on = today_ist()
  where id = 'de000000-0000-4000-8000-000000000708';

  -- CVs shared to clients (each runs the duplicate check), then the client rounds
  insert into cv_shares (pipeline_entry_id, shared_at, channels, recipients, shared_by) values
    ('de000000-0000-4000-8000-000000000701', now() - interval '6 days',   '{email}',          'JSA TMT partner',          'de000000-0000-4000-8000-000000000101'),
    ('de000000-0000-4000-8000-000000000705', now() - interval '12 days',  '{email,portal}',   'Trilegal TA team',         'de000000-0000-4000-8000-000000000102'),
    ('de000000-0000-4000-8000-000000000706', now() - interval '8 days',   '{email,portal}',   'Trilegal TA team',         'de000000-0000-4000-8000-000000000102'),
    ('de000000-0000-4000-8000-000000000709', now() - interval '15 days',  '{email,whatsapp}', 'Argus corporate partner',  'de000000-0000-4000-8000-000000000101'),
    ('de000000-0000-4000-8000-000000000713', now() - interval '4 days',   '{email}',          'Ikigai Law hiring',        'de000000-0000-4000-8000-000000000103'),
    ('de000000-0000-4000-8000-000000000718', now() - interval '50 days',  '{email,portal}',   'Trilegal TA team',         'de000000-0000-4000-8000-000000000102'),
    ('de000000-0000-4000-8000-000000000719', now() - interval '120 days', '{email}',          'Argus corporate partner',  'de000000-0000-4000-8000-000000000101');

  update pipeline_entries set stage = 'interview'   where id in ('de000000-0000-4000-8000-000000000701', 'de000000-0000-4000-8000-000000000706', 'de000000-0000-4000-8000-000000000713');
  update pipeline_entries set stage = 'final_round' where id = 'de000000-0000-4000-8000-000000000705';
  update pipeline_entries set stage = 'offer'       where id in ('de000000-0000-4000-8000-000000000718', 'de000000-0000-4000-8000-000000000719');

  -- ---------- Placements ----------
  -- Kavya joined Trilegal 12 days ago: fee 10% of 21 L, invoice must go out within 30 days of joining.
  insert into placements (id, pipeline_entry_id, offer_accepted_on, joining_date, annual_fixed_salary, status) values
    ('de000000-0000-4000-8000-000000000901', 'de000000-0000-4000-8000-000000000718', today_ist() - 30, today_ist() - 12, 2100000, 'joined');
  -- Manish joined Argus 80 days ago: replacement window closes in 10 days; invoice paid.
  insert into placements (id, pipeline_entry_id, offer_accepted_on, joining_date, annual_fixed_salary, status) values
    ('de000000-0000-4000-8000-000000000902', 'de000000-0000-4000-8000-000000000719', today_ist() - 100, today_ist() - 80, 2600000, 'joined');
  insert into invoices (id, invoice_number, placement_id, client_id, invoice_date, taxable_amount, tax, gst_rate, cgst, sgst, igst, total, due_on, status, sent_by, sent_at)
  values ('de000000-0000-4000-8000-000000000951', 'DEMO-PS-01', 'de000000-0000-4000-8000-000000000902', 'de000000-0000-4000-8000-000000000303',
          today_ist() - 80, 260000, 'cgst_sgst', 18, 23400, 23400, 0, 306800, today_ist() - 65, 'sent',
          'de000000-0000-4000-8000-000000000101', now() - interval '80 days');
  insert into payments (invoice_id, received_on, amount, reference)
  values ('de000000-0000-4000-8000-000000000951', today_ist() - 60, 306800, 'NEFT (demo)');

  alter table mandates enable trigger mandates_open_after;
  perform notify_reengagement(id) from mandates where id::text like 'de000000-%' and status = 'active';

  -- How active each mandate looks on the board (two have gone quiet)
  update mandates set last_activity_at = now() - interval '9 days'  where id = 'de000000-0000-4000-8000-000000000603';
  update mandates set last_activity_at = now() - interval '12 days' where id = 'de000000-0000-4000-8000-000000000606';
  update mandates set last_activity_at = now() - interval '2 days'  where id = 'de000000-0000-4000-8000-000000000604';

  -- ---------- The re-engagement moment ----------
  -- A new Khaitan & Co M&A mandate in Bengaluru. Creating it flags the past candidates who asked for Khaitan
  -- (Ananya, Rohan, Aisha) and those who fit on practice, PQE and city, and alerts whoever spoke to them.
  insert into mandates (id, client_id, title, practice_area, pqe_min, pqe_max, city, owner_id, status, received_on, team_size)
  values ('de000000-0000-4000-8000-000000000609', 'de000000-0000-4000-8000-000000000304', 'M&A associate', 'M&A', 3, 6, 'Bengaluru',
          'de000000-0000-4000-8000-000000000102', 'active', today_ist(), '6 lawyers');
end $$;
