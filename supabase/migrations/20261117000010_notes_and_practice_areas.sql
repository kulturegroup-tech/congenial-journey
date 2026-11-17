-- Paradigm Shifters' feedback, 17 Nov 2026.
-- 1. A big free-text Notes box on each candidate, for pasting call records straight in.
-- 2. The full practice-area list Khyati sent (99 areas; her numbering skips 92-99), grouped so
--    long pickers stay usable. The groups are ours, for the pickers; rename them freely.
--    The older, broader areas are hidden, not deleted: records that already use one keep it.

-- 1. Candidate notes -------------------------------------------------------

alter table candidates
  add column notes            text,
  add column notes_updated_at timestamptz,
  add column notes_updated_by uuid references team_members (id);

create index candidates_notes_by_idx on candidates (notes_updated_by);

-- Merging two records keeps both sets of notes (the dropped record's go underneath).
create or replace function merge_candidates(p_keep uuid, p_drop uuid) returns void
language plpgsql set search_path = public as $$
declare
  k candidates;
  d candidates;
begin
  if p_keep = p_drop then raise exception 'Pick two different candidates'; end if;
  if auth.uid() is not null and not is_admin() then raise exception 'Only an admin can merge candidates'; end if;
  select * into k from candidates where id = p_keep for update;
  select * into d from candidates where id = p_drop for update;
  if k.id is null or d.id is null then raise exception 'Candidate not found'; end if;
  if exists (select 1 from pipeline_entries a join pipeline_entries b on a.mandate_id = b.mandate_id
             where a.candidate_id = p_keep and b.candidate_id = p_drop) then
    raise exception 'Both records are on the same mandate; close one of those pipeline entries first';
  end if;

  perform set_config('app.bypass_guards', 'on', true);
  update candidate_phones   set candidate_id = p_keep where candidate_id = p_drop;
  update candidate_emails   set candidate_id = p_keep where candidate_id = p_drop;
  update candidate_files    set candidate_id = p_keep where candidate_id = p_drop;
  update prior_applications set candidate_id = p_keep where candidate_id = p_drop;
  update screening_calls    set candidate_id = p_keep where candidate_id = p_drop;
  update interest_tags      set candidate_id = p_keep where candidate_id = p_drop;
  update pipeline_entries   set candidate_id = p_keep where candidate_id = p_drop;
  update cv_shares          set candidate_id = p_keep where candidate_id = p_drop;
  update placements         set candidate_id = p_keep where candidate_id = p_drop;
  update activities         set candidate_id = p_keep where candidate_id = p_drop;
  update notifications      set candidate_id = p_keep where candidate_id = p_drop;
  update import_rows        set candidate_id = p_keep, status = 'merged' where candidate_id = p_drop;

  delete from candidates where id = p_drop;
  update candidates set
    linkedin_url        = coalesce(k.linkedin_url, d.linkedin_url),
    current_firm_id     = coalesce(k.current_firm_id, d.current_firm_id),
    current_firm_raw    = coalesce(k.current_firm_raw, d.current_firm_raw),
    designation         = coalesce(k.designation, d.designation),
    practice_areas      = (select coalesce(array_agg(distinct x), '{}') from unnest(k.practice_areas || d.practice_areas) x),
    practice_start_date = coalesce(k.practice_start_date, d.practice_start_date),
    current_city        = coalesce(k.current_city, d.current_city),
    preferred_cities    = (select coalesce(array_agg(distinct x), '{}') from unnest(k.preferred_cities || d.preferred_cities) x),
    graduation_year     = coalesce(k.graduation_year, d.graduation_year),
    current_ctc         = coalesce(k.current_ctc, d.current_ctc),
    expected_ctc        = coalesce(k.expected_ctc, d.expected_ctc),
    notice_period_days  = coalesce(k.notice_period_days, d.notice_period_days),
    owner_id            = coalesce(k.owner_id, d.owner_id),
    notes               = case
                            when nullif(trim(k.notes), '') is not null and nullif(trim(d.notes), '') is not null
                              then k.notes || E'\n\n[From the merged record: ' || d.full_name || E']\n' || d.notes
                            else coalesce(nullif(trim(k.notes), ''), nullif(trim(d.notes), ''))
                          end,
    notes_updated_at    = greatest(k.notes_updated_at, d.notes_updated_at),
    notes_updated_by    = case when d.notes_updated_at > k.notes_updated_at or k.notes_updated_at is null
                            then coalesce(d.notes_updated_by, k.notes_updated_by) else k.notes_updated_by end
  where id = p_keep;

  insert into activities (entity_type, entity_id, candidate_id, actor_id, action, details)
  values ('candidates', p_keep, p_keep, auth.uid(), 'merged', jsonb_build_object('merged_name', d.full_name));
  perform set_config('app.bypass_guards', 'off', true);
end $$;

-- 2. Practice areas --------------------------------------------------------

alter table practice_areas add column category text;

insert into practice_areas (name, category, sort, aliases) values
  ('General Corporate',                           'Corporate and M&A',                    10,  '{GC,Corporate,Corp,"Corporate & Commercial"}'),
  ('M&A',                                         'Corporate and M&A',                    20,  '{"Mergers & Acquisitions","Mergers and Acquisitions"}'),
  ('Corporate Restructuring',                     'Corporate and M&A',                    30,  '{}'),
  ('Private Equity',                              'Corporate and M&A',                    40,  '{PE}'),
  ('Venture Capital and Startups',                'Corporate and M&A',                    50,  '{VC}'),
  ('Foreign Investment and Exchange Control',     'Corporate and M&A',                    60,  '{FDI,FEMA}'),
  ('Investment Funds',                            'Corporate and M&A',                    70,  '{Funds,AIF}'),
  ('Asset Management Regulatory',                 'Corporate and M&A',                    80,  '{}'),
  ('REITs and InvITs',                            'Corporate and M&A',                    90,  '{}'),
  ('Equity Capital Markets',                      'Capital Markets',                      100, '{ECM}'),
  ('Debt Capital Markets',                        'Capital Markets',                      110, '{DCM}'),
  ('International Capital Markets',               'Capital Markets',                      120, '{ICM}'),
  ('Securities Regulatory',                       'Capital Markets',                      130, '{}'),
  ('Securities Enforcement',                      'Capital Markets',                      140, '{}'),
  ('Banking and Lending',                         'Banking and Finance',                  150, '{Banking,"B&F","Banking & Finance"}'),
  ('Structured Finance',                          'Banking and Finance',                  160, '{}'),
  ('Project Finance',                             'Banking and Finance',                  170, '{}'),
  ('Asset Finance',                               'Banking and Finance',                  180, '{}'),
  ('Banking and NBFC Regulatory',                 'Banking and Finance',                  190, '{}'),
  ('Fintech and Payments',                        'Banking and Finance',                  200, '{Fintech}'),
  ('Insolvency and Bankruptcy',                   'Insolvency and Restructuring',         210, '{IBC,Insolvency}'),
  ('Debt Restructuring and Stressed Assets',      'Insolvency and Restructuring',         220, '{}'),
  ('Debt Recovery',                               'Insolvency and Restructuring',         230, '{}'),
  ('Power and Renewables',                        'Energy, Infrastructure and Projects',  240, '{}'),
  ('Electricity Regulatory and Disputes',         'Energy, Infrastructure and Projects',  250, '{}'),
  ('Oil and Gas',                                 'Energy, Infrastructure and Projects',  260, '{}'),
  ('Mining and Minerals',                         'Energy, Infrastructure and Projects',  270, '{}'),
  ('Infrastructure',                              'Energy, Infrastructure and Projects',  280, '{Infra}'),
  ('Projects and Construction',                   'Energy, Infrastructure and Projects',  290, '{}'),
  ('Public Procurement and Government Contracts', 'Energy, Infrastructure and Projects',  300, '{}'),
  ('Real Estate Transactions',                    'Real Estate',                          310, '{}'),
  ('Real Estate Development',                     'Real Estate',                          320, '{}'),
  ('Real Estate Investment',                      'Real Estate',                          330, '{}'),
  ('Real Estate Litigation',                      'Real Estate',                          340, '{}'),
  ('Commercial Litigation',                       'Disputes',                             350, '{Litigation,Disputes}'),
  ('Appellate and Court Practice',                'Disputes',                             360, '{}'),
  ('Arbitration',                                 'Disputes',                             370, '{"International Arbitration"}'),
  ('Mediation and ADR',                           'Disputes',                             380, '{}'),
  ('Corporate and Shareholder Disputes',          'Disputes',                             390, '{}'),
  ('Banking and Financial Services Litigation',   'Disputes',                             400, '{}'),
  ('Constitutional and Public Law',               'Disputes',                             410, '{}'),
  ('Service Law',                                 'Disputes',                             420, '{}'),
  ('Consumer and Product Liability',              'Disputes',                             430, '{}'),
  ('Claims Tribunals (MACT, Railway Claims)',     'Disputes',                             440, '{}'),
  ('Media and Defamation Litigation',             'Disputes',                             450, '{}'),
  ('White Collar Crime',                          'White Collar and Criminal',            460, '{"White Collar"}'),
  ('Investigations',                              'White Collar and Criminal',            470, '{}'),
  ('Anti-corruption and Compliance',              'White Collar and Criminal',            480, '{}'),
  ('General Criminal',                            'White Collar and Criminal',            490, '{}'),
  ('Competition / Antitrust',                     'Competition, Tax and Trade',           500, '{Competition,Antitrust,"Competition Law"}'),
  ('Direct Tax',                                  'Competition, Tax and Trade',           510, '{}'),
  ('Transfer Pricing',                            'Competition, Tax and Trade',           520, '{}'),
  ('Indirect Tax (GST, Customs)',                 'Competition, Tax and Trade',           530, '{GST}'),
  ('Tax Litigation',                              'Competition, Tax and Trade',           540, '{}'),
  ('International Trade',                         'Competition, Tax and Trade',           550, '{}'),
  ('Trademarks',                                  'Intellectual Property',                560, '{}'),
  ('Patents',                                     'Intellectual Property',                570, '{}'),
  ('Copyright and Designs',                       'Intellectual Property',                580, '{}'),
  ('IP Litigation and Enforcement',               'Intellectual Property',                590, '{}'),
  ('IP Licensing and Commercialisation',          'Intellectual Property',                600, '{}'),
  ('Advertising Law',                             'Intellectual Property',                610, '{}'),
  ('Technology Transactions',                     'Technology, Media and Telecom',        620, '{TMT,Tech}'),
  ('Data Privacy and Cybersecurity',              'Technology, Media and Telecom',        630, '{"Data Protection",Privacy}'),
  ('Telecom Regulatory',                          'Technology, Media and Telecom',        640, '{}'),
  ('Space and Satellite',                         'Technology, Media and Telecom',        650, '{}'),
  ('Emerging Tech (AI, Crypto, Web3, Drones)',    'Technology, Media and Telecom',        660, '{}'),
  ('E-commerce and Intermediary Regulation',      'Technology, Media and Telecom',        670, '{}'),
  ('Media and Entertainment',                     'Technology, Media and Telecom',        680, '{}'),
  ('Gaming',                                      'Technology, Media and Telecom',        690, '{}'),
  ('Sports Law',                                  'Technology, Media and Telecom',        700, '{}'),
  ('Fashion, Luxury and Art Law',                 'Technology, Media and Telecom',        710, '{}'),
  ('Employment Advisory',                         'Employment',                           720, '{Employment,Labour}'),
  ('Industrial Relations and Labour Compliance',  'Employment',                           730, '{}'),
  ('Employment Litigation',                       'Employment',                           740, '{}'),
  ('POSH and Workplace Investigations',           'Employment',                           750, '{POSH}'),
  ('Executive Compensation and ESOPs',            'Employment',                           760, '{}'),
  ('Immigration',                                 'Employment',                           770, '{}'),
  ('Insurance and Reinsurance',                   'Sectors',                              780, '{}'),
  ('Pharma and Life Sciences',                    'Sectors',                              790, '{}'),
  ('Healthcare and Medical Devices',              'Sectors',                              800, '{}'),
  ('Food, Consumer Goods and Legal Metrology',    'Sectors',                              810, '{}'),
  ('Defence and Aerospace',                       'Sectors',                              820, '{}'),
  ('Aviation',                                    'Sectors',                              830, '{}'),
  ('Shipping, Maritime and Admiralty',            'Sectors',                              840, '{}'),
  ('Automotive and EV',                           'Sectors',                              850, '{}'),
  ('Cooperatives',                                'Sectors',                              860, '{}'),
  ('Environmental Law',                           'Environment and ESG',                  870, '{}'),
  ('ESG and Climate',                             'Environment and ESG',                  880, '{ESG}'),
  ('Health and Safety',                           'Environment and ESG',                  890, '{}'),
  ('Estate and Succession Planning',              'Private Client',                       900, '{}'),
  ('Trusts and Family Offices',                   'Private Client',                       910, '{}'),
  ('Family Matters',                              'Private Client',                       920, '{}'),
  ('Probate and Testamentary Matters',            'Private Client',                       930, '{}'),
  ('Government Affairs and Policy',               'Public Policy',                        940, '{Policy}'),
  ('Public International Law',                    'Public Policy',                        950, '{}'),
  ('In-house Legal and Compliance',               'In-house and Legal Operations',        960, '{In-house}'),
  ('Legal Operations and Legal Tech',             'In-house and Legal Operations',        970, '{}'),
  ('Legal Process Outsourcing / ALSPs',           'In-house and Legal Operations',        980, '{LPO}'),
  ('Knowledge Management',                        'In-house and Legal Operations',        990, '{KM}')
on conflict (name) do update set
  category = excluded.category,
  sort     = excluded.sort,
  aliases  = excluded.aliases,
  active   = true;

-- The first, broader list. Hidden from pickers; a candidate or mandate that already uses one keeps it.
update practice_areas
set active = false, aliases = '{}', sort = 9000 + sort
where name in ('PE/VC', 'Banking & Finance', 'Capital Markets', 'Funds', 'TMT', 'Data Protection', 'Disputes',
               'White Collar', 'Real Estate', 'Energy & Infrastructure', 'Competition', 'Tax', 'Employment',
               'Intellectual Property', 'Insolvency & Restructuring', 'Regulatory');
