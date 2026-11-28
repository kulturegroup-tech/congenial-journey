-- Housekeeping from Supabase's security check: two early functions had no fixed search_path, so
-- a caller could change which tables or functions their unqualified names point at. Pin them to
-- public like every function since. Behaviour is unchanged.
alter function financial_year(date) set search_path = public;
alter function import_stage(text) set search_path = public;
