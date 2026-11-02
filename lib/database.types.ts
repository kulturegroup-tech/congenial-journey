export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          action: string
          actor_id: string | null
          candidate_id: string | null
          client_id: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: number
          mandate_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          candidate_id?: string | null
          client_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: never
          mandate_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          candidate_id?: string | null
          client_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: never
          mandate_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "v_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_mandate_id_fkey"
            columns: ["mandate_id"]
            isOneToOne: false
            referencedRelation: "mandates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_mandate_id_fkey"
            columns: ["mandate_id"]
            isOneToOne: false
            referencedRelation: "v_mandate_board"
            referencedColumns: ["id"]
          },
        ]
      }
      agreement_fee_rates: {
        Row: {
          agreement_id: string
          fee_percent: number
          role_category: Database["public"]["Enums"]["role_category"]
        }
        Insert: {
          agreement_id: string
          fee_percent: number
          role_category: Database["public"]["Enums"]["role_category"]
        }
        Update: {
          agreement_id?: string
          fee_percent?: number
          role_category?: Database["public"]["Enums"]["role_category"]
        }
        Relationships: [
          {
            foreignKeyName: "agreement_fee_rates_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
        ]
      }
      agreements: {
        Row: {
          client_id: string
          cooling_off_months: number
          copy_ta_on_partner_shares: boolean
          created_at: string
          document_path: string | null
          ends_on: string | null
          id: string
          invoice_deadline_days: number | null
          no_fee_if_backed_out: boolean
          notes: string | null
          payment_days: number
          payment_from: Database["public"]["Enums"]["payment_basis"]
          portal_name: string | null
          replacement_days: number
          replacement_excludes_medical: boolean
          requires_portal: boolean
          resume_validity_months: number
          starts_on: string
          title: string
          updated_at: string
        }
        Insert: {
          client_id: string
          cooling_off_months?: number
          copy_ta_on_partner_shares?: boolean
          created_at?: string
          document_path?: string | null
          ends_on?: string | null
          id?: string
          invoice_deadline_days?: number | null
          no_fee_if_backed_out?: boolean
          notes?: string | null
          payment_days?: number
          payment_from?: Database["public"]["Enums"]["payment_basis"]
          portal_name?: string | null
          replacement_days?: number
          replacement_excludes_medical?: boolean
          requires_portal?: boolean
          resume_validity_months?: number
          starts_on: string
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          cooling_off_months?: number
          copy_ta_on_partner_shares?: boolean
          created_at?: string
          document_path?: string | null
          ends_on?: string | null
          id?: string
          invoice_deadline_days?: number | null
          no_fee_if_backed_out?: boolean
          notes?: string | null
          payment_days?: number
          payment_from?: Database["public"]["Enums"]["payment_basis"]
          portal_name?: string | null
          replacement_days?: number
          replacement_excludes_medical?: boolean
          requires_portal?: boolean
          resume_validity_months?: number
          starts_on?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agreements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_emails: {
        Row: {
          candidate_id: string
          created_at: string
          email: string
          id: string
          is_primary: boolean
          source: Database["public"]["Enums"]["contact_source"]
        }
        Insert: {
          candidate_id: string
          created_at?: string
          email: string
          id?: string
          is_primary?: boolean
          source?: Database["public"]["Enums"]["contact_source"]
        }
        Update: {
          candidate_id?: string
          created_at?: string
          email?: string
          id?: string
          is_primary?: boolean
          source?: Database["public"]["Enums"]["contact_source"]
        }
        Relationships: [
          {
            foreignKeyName: "candidate_emails_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_emails_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "v_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_files: {
        Row: {
          candidate_id: string
          created_at: string
          file_name: string
          id: string
          mime_type: string | null
          parsed_text: string | null
          storage_path: string
          uploaded_by: string | null
          version: number
        }
        Insert: {
          candidate_id: string
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string | null
          parsed_text?: string | null
          storage_path: string
          uploaded_by?: string | null
          version?: number
        }
        Update: {
          candidate_id?: string
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          parsed_text?: string | null
          storage_path?: string
          uploaded_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "candidate_files_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_files_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "v_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_phones: {
        Row: {
          added_by: string | null
          candidate_id: string
          created_at: string
          id: string
          is_primary: boolean
          phone: string
          raw: string | null
          source: Database["public"]["Enums"]["contact_source"]
        }
        Insert: {
          added_by?: string | null
          candidate_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          phone: string
          raw?: string | null
          source?: Database["public"]["Enums"]["contact_source"]
        }
        Update: {
          added_by?: string | null
          candidate_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          phone?: string
          raw?: string | null
          source?: Database["public"]["Enums"]["contact_source"]
        }
        Relationships: [
          {
            foreignKeyName: "candidate_phones_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_phones_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_phones_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "v_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          created_at: string
          current_city: string | null
          current_ctc: number | null
          current_firm_id: string | null
          current_firm_raw: string | null
          deletion_requested_at: string | null
          designation: string | null
          expected_ctc: number | null
          full_name: string
          graduation_year: number | null
          id: string
          linkedin_slug: string | null
          linkedin_url: string | null
          needs_review: boolean
          notice_period_days: number | null
          owner_id: string | null
          pqe_recorded: string | null
          practice_areas: string[]
          practice_start_date: string | null
          preferred_cities: string[]
          privacy_notice_sent_at: string | null
          review_note: string | null
          source: Database["public"]["Enums"]["candidate_source"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_city?: string | null
          current_ctc?: number | null
          current_firm_id?: string | null
          current_firm_raw?: string | null
          deletion_requested_at?: string | null
          designation?: string | null
          expected_ctc?: number | null
          full_name: string
          graduation_year?: number | null
          id?: string
          linkedin_slug?: string | null
          linkedin_url?: string | null
          needs_review?: boolean
          notice_period_days?: number | null
          owner_id?: string | null
          pqe_recorded?: string | null
          practice_areas?: string[]
          practice_start_date?: string | null
          preferred_cities?: string[]
          privacy_notice_sent_at?: string | null
          review_note?: string | null
          source?: Database["public"]["Enums"]["candidate_source"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_city?: string | null
          current_ctc?: number | null
          current_firm_id?: string | null
          current_firm_raw?: string | null
          deletion_requested_at?: string | null
          designation?: string | null
          expected_ctc?: number | null
          full_name?: string
          graduation_year?: number | null
          id?: string
          linkedin_slug?: string | null
          linkedin_url?: string | null
          needs_review?: boolean
          notice_period_days?: number | null
          owner_id?: string | null
          pqe_recorded?: string | null
          practice_areas?: string[]
          practice_start_date?: string | null
          preferred_cities?: string[]
          privacy_notice_sent_at?: string | null
          review_note?: string | null
          source?: Database["public"]["Enums"]["candidate_source"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidates_current_firm_id_fkey"
            columns: ["current_firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contacts: {
        Row: {
          city: string | null
          client_id: string
          copy_on_shares: boolean
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          role: Database["public"]["Enums"]["contact_role"]
        }
        Insert: {
          city?: string | null
          client_id: string
          copy_on_shares?: boolean
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["contact_role"]
        }
        Update: {
          city?: string | null
          client_id?: string
          copy_on_shares?: boolean
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["contact_role"]
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          billing_address: string | null
          billing_name: string | null
          created_at: string
          display_name: string
          firm_id: string
          gstin: string | null
          id: string
          notes: string | null
          owner_id: string | null
          state_code: string | null
          updated_at: string
        }
        Insert: {
          billing_address?: string | null
          billing_name?: string | null
          created_at?: string
          display_name: string
          firm_id: string
          gstin?: string | null
          id?: string
          notes?: string | null
          owner_id?: string | null
          state_code?: string | null
          updated_at?: string
        }
        Update: {
          billing_address?: string | null
          billing_name?: string | null
          created_at?: string
          display_name?: string
          firm_id?: string
          gstin?: string | null
          id?: string
          notes?: string | null
          owner_id?: string | null
          state_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: true
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      cv_shares: {
        Row: {
          candidate_id: string
          channels: Database["public"]["Enums"]["share_channel"][]
          client_id: string
          created_at: string
          cv_file_id: string | null
          duplicate_findings: Json
          id: string
          mandate_id: string
          override_reason: string | null
          pipeline_entry_id: string
          recipients: string | null
          shared_at: string
          shared_by: string
          valid_until: string
        }
        Insert: {
          candidate_id: string
          channels: Database["public"]["Enums"]["share_channel"][]
          client_id: string
          created_at?: string
          cv_file_id?: string | null
          duplicate_findings?: Json
          id?: string
          mandate_id: string
          override_reason?: string | null
          pipeline_entry_id: string
          recipients?: string | null
          shared_at?: string
          shared_by: string
          valid_until: string
        }
        Update: {
          candidate_id?: string
          channels?: Database["public"]["Enums"]["share_channel"][]
          client_id?: string
          created_at?: string
          cv_file_id?: string | null
          duplicate_findings?: Json
          id?: string
          mandate_id?: string
          override_reason?: string | null
          pipeline_entry_id?: string
          recipients?: string | null
          shared_at?: string
          shared_by?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "cv_shares_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cv_shares_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "v_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cv_shares_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cv_shares_cv_file_id_fkey"
            columns: ["cv_file_id"]
            isOneToOne: false
            referencedRelation: "candidate_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cv_shares_mandate_id_fkey"
            columns: ["mandate_id"]
            isOneToOne: false
            referencedRelation: "mandates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cv_shares_mandate_id_fkey"
            columns: ["mandate_id"]
            isOneToOne: false
            referencedRelation: "v_mandate_board"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cv_shares_pipeline_entry_id_fkey"
            columns: ["pipeline_entry_id"]
            isOneToOne: false
            referencedRelation: "pipeline_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cv_shares_shared_by_fkey"
            columns: ["shared_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      exit_reasons: {
        Row: {
          active: boolean
          code: string
          label: string
          sort: number
        }
        Insert: {
          active?: boolean
          code: string
          label: string
          sort?: number
        }
        Update: {
          active?: boolean
          code?: string
          label?: string
          sort?: number
        }
        Relationships: []
      }
      firm_grades: {
        Row: {
          firm_id: string
          grade: string
          id: string
          pqe_max: number
          pqe_min: number
        }
        Insert: {
          firm_id: string
          grade: string
          id?: string
          pqe_max: number
          pqe_min: number
        }
        Update: {
          firm_id?: string
          grade?: string
          id?: string
          pqe_max?: number
          pqe_min?: number
        }
        Relationships: [
          {
            foreignKeyName: "firm_grades_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      firms: {
        Row: {
          aliases: string[]
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["client_type"]
          name: string
          notes: string | null
          website: string | null
        }
        Insert: {
          aliases?: string[]
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["client_type"]
          name: string
          notes?: string | null
          website?: string | null
        }
        Update: {
          aliases?: string[]
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["client_type"]
          name?: string
          notes?: string | null
          website?: string | null
        }
        Relationships: []
      }
      import_rows: {
        Row: {
          batch: string
          candidate_id: string | null
          created_at: string
          id: number
          issue: string | null
          raw: Json
          row_number: number | null
          status: string
        }
        Insert: {
          batch: string
          candidate_id?: string | null
          created_at?: string
          id?: never
          issue?: string | null
          raw: Json
          row_number?: number | null
          status?: string
        }
        Update: {
          batch?: string
          candidate_id?: string | null
          created_at?: string
          id?: never
          issue?: string | null
          raw?: Json
          row_number?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_rows_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_rows_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "v_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      interest_tags: {
        Row: {
          candidate_id: string
          city: string | null
          created_at: string
          created_by: string | null
          firm_id: string | null
          id: string
          not_taken_reason: string | null
          practice_area: string | null
          role_text: string | null
          screening_call_id: string | null
        }
        Insert: {
          candidate_id: string
          city?: string | null
          created_at?: string
          created_by?: string | null
          firm_id?: string | null
          id?: string
          not_taken_reason?: string | null
          practice_area?: string | null
          role_text?: string | null
          screening_call_id?: string | null
        }
        Update: {
          candidate_id?: string
          city?: string | null
          created_at?: string
          created_by?: string | null
          firm_id?: string | null
          id?: string
          not_taken_reason?: string | null
          practice_area?: string | null
          role_text?: string | null
          screening_call_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interest_tags_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interest_tags_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "v_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interest_tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interest_tags_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interest_tags_practice_area_fkey"
            columns: ["practice_area"]
            isOneToOne: false
            referencedRelation: "practice_areas"
            referencedColumns: ["name"]
          },
          {
            foreignKeyName: "interest_tags_screening_call_id_fkey"
            columns: ["screening_call_id"]
            isOneToOne: false
            referencedRelation: "screening_calls"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          cgst: number
          client_id: string
          created_at: string
          due_on: string
          gst_rate: number
          id: string
          igst: number
          invoice_date: string
          invoice_number: string
          notes: string | null
          pdf_path: string | null
          placement_id: string
          raise_by: string | null
          sent_at: string | null
          sent_by: string | null
          sgst: number
          status: Database["public"]["Enums"]["invoice_status"]
          tax: Database["public"]["Enums"]["tax_type"]
          taxable_amount: number
          total: number
          updated_at: string
        }
        Insert: {
          cgst?: number
          client_id: string
          created_at?: string
          due_on: string
          gst_rate: number
          id?: string
          igst?: number
          invoice_date: string
          invoice_number: string
          notes?: string | null
          pdf_path?: string | null
          placement_id: string
          raise_by?: string | null
          sent_at?: string | null
          sent_by?: string | null
          sgst?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          tax: Database["public"]["Enums"]["tax_type"]
          taxable_amount: number
          total: number
          updated_at?: string
        }
        Update: {
          cgst?: number
          client_id?: string
          created_at?: string
          due_on?: string
          gst_rate?: number
          id?: string
          igst?: number
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          pdf_path?: string | null
          placement_id?: string
          raise_by?: string | null
          sent_at?: string | null
          sent_by?: string | null
          sgst?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          tax?: Database["public"]["Enums"]["tax_type"]
          taxable_amount?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "placements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      mandates: {
        Row: {
          city: string | null
          client_id: string
          client_profile: string | null
          created_at: string
          grade_label: string | null
          headcount: number
          id: string
          last_activity_at: string
          legacy_name: string | null
          owner_id: string | null
          pain_points: string | null
          pqe_max: number | null
          pqe_min: number | null
          practice_area: string | null
          received_on: string
          reopened_count: number
          replaces_placement_id: string | null
          research_notes: string | null
          role_category: Database["public"]["Enums"]["role_category"]
          soft_points: string | null
          status: Database["public"]["Enums"]["mandate_status"]
          status_changed_at: string
          team_size: string | null
          team_structure: string | null
          title: string
          updated_at: string
          work_profile: string | null
        }
        Insert: {
          city?: string | null
          client_id: string
          client_profile?: string | null
          created_at?: string
          grade_label?: string | null
          headcount?: number
          id?: string
          last_activity_at?: string
          legacy_name?: string | null
          owner_id?: string | null
          pain_points?: string | null
          pqe_max?: number | null
          pqe_min?: number | null
          practice_area?: string | null
          received_on?: string
          reopened_count?: number
          replaces_placement_id?: string | null
          research_notes?: string | null
          role_category?: Database["public"]["Enums"]["role_category"]
          soft_points?: string | null
          status?: Database["public"]["Enums"]["mandate_status"]
          status_changed_at?: string
          team_size?: string | null
          team_structure?: string | null
          title: string
          updated_at?: string
          work_profile?: string | null
        }
        Update: {
          city?: string | null
          client_id?: string
          client_profile?: string | null
          created_at?: string
          grade_label?: string | null
          headcount?: number
          id?: string
          last_activity_at?: string
          legacy_name?: string | null
          owner_id?: string | null
          pain_points?: string | null
          pqe_max?: number | null
          pqe_min?: number | null
          practice_area?: string | null
          received_on?: string
          reopened_count?: number
          replaces_placement_id?: string | null
          research_notes?: string | null
          role_category?: Database["public"]["Enums"]["role_category"]
          soft_points?: string | null
          status?: Database["public"]["Enums"]["mandate_status"]
          status_changed_at?: string
          team_size?: string | null
          team_structure?: string | null
          title?: string
          updated_at?: string
          work_profile?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mandates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mandates_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mandates_practice_area_fkey"
            columns: ["practice_area"]
            isOneToOne: false
            referencedRelation: "practice_areas"
            referencedColumns: ["name"]
          },
          {
            foreignKeyName: "mandates_replaces_fk"
            columns: ["replaces_placement_id"]
            isOneToOne: false
            referencedRelation: "placements"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          candidate_id: string | null
          created_at: string
          dedupe_key: string | null
          id: string
          kind: string
          mandate_id: string | null
          read_at: string | null
          recipient_id: string
          title: string
        }
        Insert: {
          body?: string | null
          candidate_id?: string | null
          created_at?: string
          dedupe_key?: string | null
          id?: string
          kind: string
          mandate_id?: string | null
          read_at?: string | null
          recipient_id: string
          title: string
        }
        Update: {
          body?: string | null
          candidate_id?: string | null
          created_at?: string
          dedupe_key?: string | null
          id?: string
          kind?: string
          mandate_id?: string | null
          read_at?: string | null
          recipient_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "v_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_mandate_id_fkey"
            columns: ["mandate_id"]
            isOneToOne: false
            referencedRelation: "mandates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_mandate_id_fkey"
            columns: ["mandate_id"]
            isOneToOne: false
            referencedRelation: "v_mandate_board"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          received_on: string
          recorded_by: string | null
          reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          received_on: string
          recorded_by?: string | null
          reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          received_on?: string
          recorded_by?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_entries: {
        Row: {
          candidate_id: string
          created_at: string
          exit_note: string | null
          exit_reason: string | null
          exited_at: string | null
          follow_up_on: string | null
          id: string
          mandate_id: string
          owner_id: string | null
          stage: Database["public"]["Enums"]["pipeline_stage"]
          stage_changed_at: string
          updated_at: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          exit_note?: string | null
          exit_reason?: string | null
          exited_at?: string | null
          follow_up_on?: string | null
          id?: string
          mandate_id: string
          owner_id?: string | null
          stage?: Database["public"]["Enums"]["pipeline_stage"]
          stage_changed_at?: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          exit_note?: string | null
          exit_reason?: string | null
          exited_at?: string | null
          follow_up_on?: string | null
          id?: string
          mandate_id?: string
          owner_id?: string | null
          stage?: Database["public"]["Enums"]["pipeline_stage"]
          stage_changed_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_entries_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_entries_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "v_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_entries_exit_reason_fkey"
            columns: ["exit_reason"]
            isOneToOne: false
            referencedRelation: "exit_reasons"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "pipeline_entries_mandate_id_fkey"
            columns: ["mandate_id"]
            isOneToOne: false
            referencedRelation: "mandates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_entries_mandate_id_fkey"
            columns: ["mandate_id"]
            isOneToOne: false
            referencedRelation: "v_mandate_board"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_entries_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      placements: {
        Row: {
          agreement_id: string | null
          annual_fixed_salary: number
          candidate_id: string
          client_id: string
          created_at: string
          fee_amount: number | null
          fee_percent: number | null
          id: string
          joining_date: string | null
          left_for_medical: boolean
          left_on: string | null
          left_reason: string | null
          mandate_id: string
          offer_accepted_on: string | null
          pipeline_entry_id: string
          replacement_mandate_id: string | null
          replacement_until: string | null
          status: Database["public"]["Enums"]["placement_status"]
          updated_at: string
        }
        Insert: {
          agreement_id?: string | null
          annual_fixed_salary: number
          candidate_id: string
          client_id: string
          created_at?: string
          fee_amount?: number | null
          fee_percent?: number | null
          id?: string
          joining_date?: string | null
          left_for_medical?: boolean
          left_on?: string | null
          left_reason?: string | null
          mandate_id: string
          offer_accepted_on?: string | null
          pipeline_entry_id: string
          replacement_mandate_id?: string | null
          replacement_until?: string | null
          status?: Database["public"]["Enums"]["placement_status"]
          updated_at?: string
        }
        Update: {
          agreement_id?: string | null
          annual_fixed_salary?: number
          candidate_id?: string
          client_id?: string
          created_at?: string
          fee_amount?: number | null
          fee_percent?: number | null
          id?: string
          joining_date?: string | null
          left_for_medical?: boolean
          left_on?: string | null
          left_reason?: string | null
          mandate_id?: string
          offer_accepted_on?: string | null
          pipeline_entry_id?: string
          replacement_mandate_id?: string | null
          replacement_until?: string | null
          status?: Database["public"]["Enums"]["placement_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "placements_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "v_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_mandate_id_fkey"
            columns: ["mandate_id"]
            isOneToOne: false
            referencedRelation: "mandates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_mandate_id_fkey"
            columns: ["mandate_id"]
            isOneToOne: false
            referencedRelation: "v_mandate_board"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_pipeline_entry_id_fkey"
            columns: ["pipeline_entry_id"]
            isOneToOne: true
            referencedRelation: "pipeline_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_replacement_mandate_id_fkey"
            columns: ["replacement_mandate_id"]
            isOneToOne: false
            referencedRelation: "mandates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_replacement_mandate_id_fkey"
            columns: ["replacement_mandate_id"]
            isOneToOne: false
            referencedRelation: "v_mandate_board"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_areas: {
        Row: {
          active: boolean
          aliases: string[]
          name: string
          sort: number
        }
        Insert: {
          active?: boolean
          aliases?: string[]
          name: string
          sort?: number
        }
        Update: {
          active?: boolean
          aliases?: string[]
          name?: string
          sort?: number
        }
        Relationships: []
      }
      prior_applications: {
        Row: {
          applied_on: string | null
          candidate_id: string
          created_at: string
          details: string | null
          firm_id: string
          id: string
          recorded_by: string | null
          route: Database["public"]["Enums"]["prior_route"]
        }
        Insert: {
          applied_on?: string | null
          candidate_id: string
          created_at?: string
          details?: string | null
          firm_id: string
          id?: string
          recorded_by?: string | null
          route: Database["public"]["Enums"]["prior_route"]
        }
        Update: {
          applied_on?: string | null
          candidate_id?: string
          created_at?: string
          details?: string | null
          firm_id?: string
          id?: string
          recorded_by?: string | null
          route?: Database["public"]["Enums"]["prior_route"]
        }
        Relationships: [
          {
            foreignKeyName: "prior_applications_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prior_applications_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "v_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prior_applications_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prior_applications_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      screening_calls: {
        Row: {
          action_points: string | null
          applications_made: string | null
          called_at: string | null
          candidate_id: string
          created_at: string
          current_city: string | null
          current_ctc: number | null
          discussion: string | null
          education: string | null
          expected_ctc: number | null
          google_event_id: string | null
          id: string
          industries_clients: string | null
          looking_for: string | null
          mandate_id: string | null
          nature_of_work: string | null
          non_negotiables: string | null
          notice_period_days: number | null
          outcome: Database["public"]["Enums"]["call_outcome"] | null
          recruiter_id: string
          scheduled_for: string | null
          status: Database["public"]["Enums"]["call_status"]
          team_experience: string | null
          updated_at: string
          work_history: string | null
        }
        Insert: {
          action_points?: string | null
          applications_made?: string | null
          called_at?: string | null
          candidate_id: string
          created_at?: string
          current_city?: string | null
          current_ctc?: number | null
          discussion?: string | null
          education?: string | null
          expected_ctc?: number | null
          google_event_id?: string | null
          id?: string
          industries_clients?: string | null
          looking_for?: string | null
          mandate_id?: string | null
          nature_of_work?: string | null
          non_negotiables?: string | null
          notice_period_days?: number | null
          outcome?: Database["public"]["Enums"]["call_outcome"] | null
          recruiter_id?: string
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["call_status"]
          team_experience?: string | null
          updated_at?: string
          work_history?: string | null
        }
        Update: {
          action_points?: string | null
          applications_made?: string | null
          called_at?: string | null
          candidate_id?: string
          created_at?: string
          current_city?: string | null
          current_ctc?: number | null
          discussion?: string | null
          education?: string | null
          expected_ctc?: number | null
          google_event_id?: string | null
          id?: string
          industries_clients?: string | null
          looking_for?: string | null
          mandate_id?: string | null
          nature_of_work?: string | null
          non_negotiables?: string | null
          notice_period_days?: number | null
          outcome?: Database["public"]["Enums"]["call_outcome"] | null
          recruiter_id?: string
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["call_status"]
          team_experience?: string | null
          updated_at?: string
          work_history?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "screening_calls_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screening_calls_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "v_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screening_calls_mandate_id_fkey"
            columns: ["mandate_id"]
            isOneToOne: false
            referencedRelation: "mandates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screening_calls_mandate_id_fkey"
            columns: ["mandate_id"]
            isOneToOne: false
            referencedRelation: "v_mandate_board"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screening_calls_recruiter_id_fkey"
            columns: ["recruiter_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          address: string | null
          bank_details: string | null
          default_cooling_off_months: number
          default_resume_validity_months: number
          firm_name: string
          gst_rate: number
          gstin: string | null
          home_state_code: string
          id: boolean
          invoice_prefix: string
          next_invoice_serial: number
          sac_code: string
          stale_after_working_days: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          bank_details?: string | null
          default_cooling_off_months?: number
          default_resume_validity_months?: number
          firm_name?: string
          gst_rate?: number
          gstin?: string | null
          home_state_code?: string
          id?: boolean
          invoice_prefix?: string
          next_invoice_serial?: number
          sac_code?: string
          stale_after_working_days?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          bank_details?: string | null
          default_cooling_off_months?: number
          default_resume_validity_months?: number
          firm_name?: string
          gst_rate?: number
          gstin?: string | null
          home_state_code?: string
          id?: boolean
          invoice_prefix?: string
          next_invoice_serial?: number
          sac_code?: string
          stale_after_working_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          active: boolean
          created_at: string
          email: string
          full_name: string
          id: string
          is_admin: boolean
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          full_name: string
          id: string
          is_admin?: boolean
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_admin?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      v_candidates: {
        Row: {
          created_at: string | null
          current_city: string | null
          current_ctc: number | null
          current_firm: string | null
          current_firm_id: string | null
          current_firm_raw: string | null
          deletion_requested_at: string | null
          designation: string | null
          emails: string[] | null
          expected_ctc: number | null
          full_name: string | null
          graduation_year: number | null
          id: string | null
          last_called_at: string | null
          last_called_by: string | null
          linkedin_slug: string | null
          linkedin_url: string | null
          needs_review: boolean | null
          notice_period_days: number | null
          owner_id: string | null
          phones: string[] | null
          pqe_recorded: string | null
          pqe_today: number | null
          practice_areas: string[] | null
          practice_start_date: string | null
          preferred_cities: string[] | null
          privacy_notice_sent_at: string | null
          review_note: string | null
          seniority: string | null
          source: Database["public"]["Enums"]["candidate_source"] | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidates_current_firm_id_fkey"
            columns: ["current_firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screening_calls_recruiter_id_fkey"
            columns: ["last_called_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      v_live_submissions: {
        Row: {
          candidate_id: string | null
          client: string | null
          client_id: string | null
          full_name: string | null
          id: string | null
          mandate: string | null
          mandate_id: string | null
          placed: boolean | null
          shared_at: string | null
          shared_by: string | null
          valid_until: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cv_shares_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cv_shares_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "v_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cv_shares_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cv_shares_mandate_id_fkey"
            columns: ["mandate_id"]
            isOneToOne: false
            referencedRelation: "mandates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cv_shares_mandate_id_fkey"
            columns: ["mandate_id"]
            isOneToOne: false
            referencedRelation: "v_mandate_board"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cv_shares_shared_by_fkey"
            columns: ["shared_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      v_mandate_board: {
        Row: {
          city: string | null
          client: string | null
          client_id: string | null
          cvs_shared: number | null
          days_open: number | null
          grade_label: string | null
          id: string | null
          in_play: number | null
          interviewed: number | null
          is_stale: boolean | null
          joined: number | null
          last_activity_at: string | null
          owner_id: string | null
          pqe_max: number | null
          pqe_min: number | null
          practice_area: string | null
          received_on: string | null
          status: Database["public"]["Enums"]["mandate_status"] | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mandates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mandates_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mandates_practice_area_fkey"
            columns: ["practice_area"]
            isOneToOne: false
            referencedRelation: "practice_areas"
            referencedColumns: ["name"]
          },
        ]
      }
      v_reminders: {
        Row: {
          candidate_id: string | null
          client_id: string | null
          due_on: string | null
          kind: string | null
          mandate_id: string | null
          recipient_id: string | null
          ref_id: string | null
          title: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_upsert_member: {
        Args: {
          p_email: string
          p_full_name: string
          p_is_admin?: boolean
          p_pin?: string
        }
        Returns: string
      }
      check_duplicate: {
        Args: {
          p_candidate: string
          p_client: string
          p_exclude_entry?: string
        }
        Returns: {
          blocking: boolean
          detail: string
          rule: string
          seen_on: string
        }[]
      }
      create_invoice: {
        Args: { p_invoice_date?: string; p_placement: string }
        Returns: {
          cgst: number
          client_id: string
          created_at: string
          due_on: string
          gst_rate: number
          id: string
          igst: number
          invoice_date: string
          invoice_number: string
          notes: string | null
          pdf_path: string | null
          placement_id: string
          raise_by: string | null
          sent_at: string | null
          sent_by: string | null
          sgst: number
          status: Database["public"]["Enums"]["invoice_status"]
          tax: Database["public"]["Enums"]["tax_type"]
          taxable_amount: number
          total: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_agreement: {
        Args: { p_client: string; p_on?: string }
        Returns: {
          client_id: string
          cooling_off_months: number
          copy_ta_on_partner_shares: boolean
          created_at: string
          document_path: string | null
          ends_on: string | null
          id: string
          invoice_deadline_days: number | null
          no_fee_if_backed_out: boolean
          notes: string | null
          payment_days: number
          payment_from: Database["public"]["Enums"]["payment_basis"]
          portal_name: string | null
          replacement_days: number
          replacement_excludes_medical: boolean
          requires_portal: boolean
          resume_validity_months: number
          starts_on: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "agreements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_admin: { Args: never; Returns: boolean }
      is_team_member: { Args: never; Returns: boolean }
      linkedin_slug: { Args: { url: string }; Returns: string }
      lookup: {
        Args: { p_limit?: number; q: string }
        Returns: {
          candidate_id: string
          current_firm: string
          emails: string[]
          full_name: string
          last_called_at: string
          last_called_by: string
          linkedin_url: string
          matched_on: string
          phones: string[]
          pqe_today: number
        }[]
      }
      match_candidates_for_mandate: {
        Args: { p_limit?: number; p_mandate: string }
        Returns: {
          candidate_id: string
          full_name: string
          last_called_at: string
          last_recruiter_id: string
          pqe_today: number
          reasons: string[]
          score: number
        }[]
      }
      merge_candidates: {
        Args: { p_drop: string; p_keep: string }
        Returns: undefined
      }
      normalize_phones: { Args: { raw: string }; Returns: string[] }
      notify_reengagement: { Args: { p_mandate: string }; Returns: number }
      parse_sheet_pqe: {
        Args: { as_of?: string; raw: string }
        Returns: string
      }
      pqe_years: {
        Args: { as_of?: string; practice_start: string }
        Returns: number
      }
      resolve_firm: {
        Args: { p_create?: boolean; p_name: string }
        Returns: string
      }
      seniority_band: { Args: { pqe: number }; Returns: string }
      today_ist: { Args: never; Returns: string }
      working_days_between: {
        Args: { d1: string; d2: string }
        Returns: number
      }
    }
    Enums: {
      call_outcome: "fit" | "not_fit" | "follow_up"
      call_status: "scheduled" | "done" | "missed" | "cancelled"
      candidate_source:
        | "linkedin_outreach"
        | "inbound"
        | "referral"
        | "odoo_import"
        | "sheet_import"
        | "other"
      client_type: "law_firm" | "company"
      contact_role: "partner" | "hr_ta" | "other"
      contact_source:
        | "manual"
        | "weekday"
        | "cv"
        | "candidate"
        | "odoo_import"
        | "sheet_import"
      invoice_status: "draft" | "sent" | "part_paid" | "paid" | "cancelled"
      mandate_status: "active" | "on_hold" | "filled" | "lost"
      payment_basis: "invoice_date" | "joining_date"
      pipeline_stage:
        | "mapped"
        | "called"
        | "pitched"
        | "confirmed"
        | "cv_shared"
        | "interview"
        | "assignment"
        | "final_round"
        | "offer"
        | "documents"
        | "doj_fixed"
        | "joined"
      placement_status:
        | "offer_accepted"
        | "joined"
        | "backed_out"
        | "left_in_window"
        | "completed"
      prior_route:
        | "other_agency"
        | "job_portal"
        | "client_website"
        | "direct_email"
        | "other"
      role_category: "legal" | "support_staff"
      share_channel: "email" | "whatsapp" | "portal"
      tax_type: "cgst_sgst" | "igst"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      call_outcome: ["fit", "not_fit", "follow_up"],
      call_status: ["scheduled", "done", "missed", "cancelled"],
      candidate_source: [
        "linkedin_outreach",
        "inbound",
        "referral",
        "odoo_import",
        "sheet_import",
        "other",
      ],
      client_type: ["law_firm", "company"],
      contact_role: ["partner", "hr_ta", "other"],
      contact_source: [
        "manual",
        "weekday",
        "cv",
        "candidate",
        "odoo_import",
        "sheet_import",
      ],
      invoice_status: ["draft", "sent", "part_paid", "paid", "cancelled"],
      mandate_status: ["active", "on_hold", "filled", "lost"],
      payment_basis: ["invoice_date", "joining_date"],
      pipeline_stage: [
        "mapped",
        "called",
        "pitched",
        "confirmed",
        "cv_shared",
        "interview",
        "assignment",
        "final_round",
        "offer",
        "documents",
        "doj_fixed",
        "joined",
      ],
      placement_status: [
        "offer_accepted",
        "joined",
        "backed_out",
        "left_in_window",
        "completed",
      ],
      prior_route: [
        "other_agency",
        "job_portal",
        "client_website",
        "direct_email",
        "other",
      ],
      role_category: ["legal", "support_staff"],
      share_channel: ["email", "whatsapp", "portal"],
      tax_type: ["cgst_sgst", "igst"],
    },
  },
} as const
