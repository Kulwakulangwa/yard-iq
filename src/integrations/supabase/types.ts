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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          created_at: string | null
          id: string
          key: string
          label: string
          updated_at: string | null
          value: string | null
          value_type: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          label: string
          updated_at?: string | null
          value?: string | null
          value_type?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          label?: string
          updated_at?: string | null
          value?: string | null
          value_type?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          details: Json | null
          entity: string | null
          entity_id: string | null
          id: string
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          details?: Json | null
          entity?: string | null
          entity_id?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          details?: Json | null
          entity?: string | null
          entity_id?: string | null
          id?: string
        }
        Relationships: []
      }
      contracts: {
        Row: {
          contract_amount: number
          contract_currency: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          end_date: string | null
          id: string
          notes: string | null
          route: string | null
          start_date: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          contract_amount?: number
          contract_currency?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          route?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          contract_amount?: number
          contract_currency?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          route?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          status: string
          tax_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          status?: string
          tax_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          status?: string
          tax_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      driver_payments: {
        Row: {
          amount_tzs: number
          created_at: string
          created_by: string | null
          driver_id: string | null
          id: string
          notes: string | null
          payment_date: string
          payment_type: string
          period_label: string | null
          reference_trip: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount_tzs?: number
          created_at?: string
          created_by?: string | null
          driver_id?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_type?: string
          period_label?: string | null
          reference_trip?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount_tzs?: number
          created_at?: string
          created_by?: string | null
          driver_id?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_type?: string
          period_label?: string | null
          reference_trip?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_payments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_payments_reference_trip_fkey"
            columns: ["reference_trip"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          assigned_vehicle: string | null
          base_location: string | null
          created_at: string
          created_by: string | null
          driver_code: string | null
          full_name: string
          id: string
          licence_expiry: string | null
          licence_number: string | null
          monthly_salary_tzs: number | null
          notes: string | null
          phone: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assigned_vehicle?: string | null
          base_location?: string | null
          created_at?: string
          created_by?: string | null
          driver_code?: string | null
          full_name: string
          id?: string
          licence_expiry?: string | null
          licence_number?: string | null
          monthly_salary_tzs?: number | null
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assigned_vehicle?: string | null
          base_location?: string | null
          created_at?: string
          created_by?: string | null
          driver_code?: string | null
          full_name?: string
          id?: string
          licence_expiry?: string | null
          licence_number?: string | null
          monthly_salary_tzs?: number | null
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      evidence_files: {
        Row: {
          created_at: string
          created_by: string | null
          file_name: string | null
          file_path: string | null
          id: string
          incident_id: string | null
          kind: string | null
          notes: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          incident_id?: string | null
          kind?: string | null
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          incident_id?: string | null
          kind?: string | null
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_files_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      exceptions: {
        Row: {
          actual_value: string | null
          created_at: string
          created_by: string | null
          exception_number: string
          exception_type: string
          expected_value: string | null
          fuel_allocation_id: string | null
          id: string
          load_id: string | null
          reason: string | null
          required_approver: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          status: string
          tire_id: string | null
          trip_id: string | null
          updated_at: string
          updated_by: string | null
          vehicle_id: string | null
        }
        Insert: {
          actual_value?: string | null
          created_at?: string
          created_by?: string | null
          exception_number: string
          exception_type: string
          expected_value?: string | null
          fuel_allocation_id?: string | null
          id?: string
          load_id?: string | null
          reason?: string | null
          required_approver?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          tire_id?: string | null
          trip_id?: string | null
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string | null
        }
        Update: {
          actual_value?: string | null
          created_at?: string
          created_by?: string | null
          exception_number?: string
          exception_type?: string
          expected_value?: string | null
          fuel_allocation_id?: string | null
          id?: string
          load_id?: string | null
          reason?: string | null
          required_approver?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          tire_id?: string | null
          trip_id?: string | null
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exceptions_fuel_allocation_id_fkey"
            columns: ["fuel_allocation_id"]
            isOneToOne: false
            referencedRelation: "fuel_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exceptions_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "loads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exceptions_tire_id_fkey"
            columns: ["tire_id"]
            isOneToOne: false
            referencedRelation: "tires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exceptions_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exceptions_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          currency: string | null
          expense_date: string
          expense_number: string
          id: string
          incident_id: string | null
          load_id: string | null
          notes: string | null
          receipt_url: string | null
          status: string
          supplier: string | null
          trip_id: string | null
          updated_at: string
          updated_by: string | null
          vehicle_id: string | null
          volume_liters: number | null
          work_order_id: string | null
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          expense_date?: string
          expense_number: string
          id?: string
          incident_id?: string | null
          load_id?: string | null
          notes?: string | null
          receipt_url?: string | null
          status?: string
          supplier?: string | null
          trip_id?: string | null
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string | null
          volume_liters?: number | null
          work_order_id?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          expense_date?: string
          expense_number?: string
          id?: string
          incident_id?: string | null
          load_id?: string | null
          notes?: string | null
          receipt_url?: string | null
          status?: string
          supplier?: string | null
          trip_id?: string | null
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string | null
          volume_liters?: number | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "loads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_allocations: {
        Row: {
          approved_litres: number | null
          created_at: string
          created_by: string | null
          currency: string | null
          driver_id: string | null
          fuel_cost: number | null
          fuel_type: string | null
          id: string
          notes: string | null
          planned_litres: number | null
          receipt_number: string | null
          reference: string
          status: string
          supplier: string | null
          trip_id: string | null
          updated_at: string
          updated_by: string | null
          vehicle_id: string | null
        }
        Insert: {
          approved_litres?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          driver_id?: string | null
          fuel_cost?: number | null
          fuel_type?: string | null
          id?: string
          notes?: string | null
          planned_litres?: number | null
          receipt_number?: string | null
          reference: string
          status?: string
          supplier?: string | null
          trip_id?: string | null
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string | null
        }
        Update: {
          approved_litres?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          driver_id?: string | null
          fuel_cost?: number | null
          fuel_type?: string | null
          id?: string
          notes?: string | null
          planned_litres?: number | null
          receipt_number?: string | null
          reference?: string
          status?: string
          supplier?: string | null
          trip_id?: string | null
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fuel_allocations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_allocations_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_allocations_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      gate_entries: {
        Row: {
          created_at: string
          created_by: string | null
          decision: string | null
          direction: string
          driver_id: string | null
          event_time: string
          fuel_verified: boolean | null
          id: string
          inspection_verified: boolean | null
          maintenance_hold: boolean | null
          notes: string | null
          odometer: number | null
          officer: string | null
          seal_verified: boolean | null
          trip_id: string | null
          updated_at: string
          updated_by: string | null
          vehicle_condition: string | null
          vehicle_id: string | null
          yard_zone: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          decision?: string | null
          direction?: string
          driver_id?: string | null
          event_time?: string
          fuel_verified?: boolean | null
          id?: string
          inspection_verified?: boolean | null
          maintenance_hold?: boolean | null
          notes?: string | null
          odometer?: number | null
          officer?: string | null
          seal_verified?: boolean | null
          trip_id?: string | null
          updated_at?: string
          updated_by?: string | null
          vehicle_condition?: string | null
          vehicle_id?: string | null
          yard_zone?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          decision?: string | null
          direction?: string
          driver_id?: string | null
          event_time?: string
          fuel_verified?: boolean | null
          id?: string
          inspection_verified?: boolean | null
          maintenance_hold?: boolean | null
          notes?: string | null
          odometer?: number | null
          officer?: string | null
          seal_verified?: boolean | null
          trip_id?: string | null
          updated_at?: string
          updated_by?: string | null
          vehicle_condition?: string | null
          vehicle_id?: string | null
          yard_zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gate_entries_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gate_entries_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gate_entries_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          driver_id: string | null
          financial_impact: number | null
          id: string
          incident_number: string
          incident_type: string
          investigator: string | null
          load_id: string | null
          location: string | null
          occurred_at: string
          people_involved: string | null
          severity: string
          status: string
          tire_id: string | null
          trip_id: string | null
          updated_at: string
          updated_by: string | null
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          driver_id?: string | null
          financial_impact?: number | null
          id?: string
          incident_number: string
          incident_type?: string
          investigator?: string | null
          load_id?: string | null
          location?: string | null
          occurred_at?: string
          people_involved?: string | null
          severity?: string
          status?: string
          tire_id?: string | null
          trip_id?: string | null
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          driver_id?: string | null
          financial_impact?: number | null
          id?: string
          incident_number?: string
          incident_type?: string
          investigator?: string | null
          load_id?: string | null
          location?: string | null
          occurred_at?: string
          people_involved?: string | null
          severity?: string
          status?: string
          tire_id?: string | null
          trip_id?: string | null
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incidents_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "loads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_tire_id_fkey"
            columns: ["tire_id"]
            isOneToOne: false
            referencedRelation: "tires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          attachment_url: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          customer_id: string | null
          due_date: string | null
          id: string
          invoice_number: string
          load_id: string | null
          paid_amount_tzs: number | null
          paid_at: string | null
          period_end: string | null
          period_start: string | null
          sent_at: string | null
          status: string
          subtotal_tzs: number | null
          tax: number | null
          total_amount_tzs: number | null
          trip_id: string | null
          updated_at: string
          updated_by: string | null
          vat_amount_tzs: number | null
          vat_percent: number | null
        }
        Insert: {
          amount?: number
          attachment_url?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          customer_id?: string | null
          due_date?: string | null
          id?: string
          invoice_number: string
          load_id?: string | null
          paid_amount_tzs?: number | null
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          sent_at?: string | null
          status?: string
          subtotal_tzs?: number | null
          tax?: number | null
          total_amount_tzs?: number | null
          trip_id?: string | null
          updated_at?: string
          updated_by?: string | null
          vat_amount_tzs?: number | null
          vat_percent?: number | null
        }
        Update: {
          amount?: number
          attachment_url?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          customer_id?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          load_id?: string | null
          paid_amount_tzs?: number | null
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          sent_at?: string | null
          status?: string
          subtotal_tzs?: number | null
          tax?: number | null
          total_amount_tzs?: number | null
          trip_id?: string | null
          updated_at?: string
          updated_by?: string | null
          vat_amount_tzs?: number | null
          vat_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "loads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      loads: {
        Row: {
          actual_quantity: number | null
          actual_seal_number: string | null
          actual_weight: number | null
          cargo_category: string | null
          cargo_description: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          destination: string | null
          expected_quantity: number | null
          expected_weight: number | null
          id: string
          load_reference: string
          loading_end: string | null
          loading_officer: string | null
          loading_start: string | null
          notes: string | null
          origin: string | null
          planned_loading_date: string | null
          seal_number: string | null
          status: string
          trip_id: string | null
          unit_of_measure: string | null
          updated_at: string
          updated_by: string | null
          variance_reason: string | null
          verification_officer: string | null
        }
        Insert: {
          actual_quantity?: number | null
          actual_seal_number?: string | null
          actual_weight?: number | null
          cargo_category?: string | null
          cargo_description?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          destination?: string | null
          expected_quantity?: number | null
          expected_weight?: number | null
          id?: string
          load_reference: string
          loading_end?: string | null
          loading_officer?: string | null
          loading_start?: string | null
          notes?: string | null
          origin?: string | null
          planned_loading_date?: string | null
          seal_number?: string | null
          status?: string
          trip_id?: string | null
          unit_of_measure?: string | null
          updated_at?: string
          updated_by?: string | null
          variance_reason?: string | null
          verification_officer?: string | null
        }
        Update: {
          actual_quantity?: number | null
          actual_seal_number?: string | null
          actual_weight?: number | null
          cargo_category?: string | null
          cargo_description?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          destination?: string | null
          expected_quantity?: number | null
          expected_weight?: number | null
          id?: string
          load_reference?: string
          loading_end?: string | null
          loading_officer?: string | null
          loading_start?: string | null
          notes?: string | null
          origin?: string | null
          planned_loading_date?: string | null
          seal_number?: string | null
          status?: string
          trip_id?: string | null
          unit_of_measure?: string | null
          updated_at?: string
          updated_by?: string | null
          variance_reason?: string | null
          verification_officer?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loads_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loads_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_expenses: {
        Row: {
          amount_tzs: number
          category: string
          created_at: string
          created_by: string | null
          description: string
          expense_date: string
          id: string
          notes: string | null
          receipt_url: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount_tzs?: number
          category?: string
          created_at?: string
          created_by?: string | null
          description: string
          expense_date?: string
          id?: string
          notes?: string | null
          receipt_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount_tzs?: number
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          expense_date?: string
          id?: string
          notes?: string | null
          receipt_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      police_cases: {
        Row: {
          case_number: string | null
          case_status: string
          created_at: string
          created_by: string | null
          follow_up_notes: string | null
          id: string
          incident_id: string | null
          officer_contact: string | null
          police_station: string | null
          reported_on: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          case_number?: string | null
          case_status?: string
          created_at?: string
          created_by?: string | null
          follow_up_notes?: string | null
          id?: string
          incident_id?: string | null
          officer_contact?: string | null
          police_station?: string | null
          reported_on?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          case_number?: string | null
          case_status?: string
          created_at?: string
          created_by?: string | null
          follow_up_notes?: string | null
          id?: string
          incident_id?: string | null
          officer_contact?: string | null
          police_station?: string | null
          reported_on?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "police_cases_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      technicians: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          id: string
          phone: string | null
          speciality: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          speciality?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          speciality?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      tire_movements: {
        Row: {
          approved: boolean
          condition: string | null
          created_at: string
          created_by: string | null
          destination_location: string | null
          id: string
          moved_at: string
          movement_type: string
          odometer: number | null
          reason: string | null
          technician: string | null
          tire_id: string | null
          updated_at: string
          updated_by: string | null
          vehicle_id: string | null
          verifier: string | null
          wheel_position: string | null
        }
        Insert: {
          approved?: boolean
          condition?: string | null
          created_at?: string
          created_by?: string | null
          destination_location?: string | null
          id?: string
          moved_at?: string
          movement_type: string
          odometer?: number | null
          reason?: string | null
          technician?: string | null
          tire_id?: string | null
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string | null
          verifier?: string | null
          wheel_position?: string | null
        }
        Update: {
          approved?: boolean
          condition?: string | null
          created_at?: string
          created_by?: string | null
          destination_location?: string | null
          id?: string
          moved_at?: string
          movement_type?: string
          odometer?: number | null
          reason?: string | null
          technician?: string | null
          tire_id?: string | null
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string | null
          verifier?: string | null
          wheel_position?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tire_movements_tire_id_fkey"
            columns: ["tire_id"]
            isOneToOne: false
            referencedRelation: "tires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tire_movements_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      tires: {
        Row: {
          brand: string | null
          condition: string | null
          created_at: string
          created_by: string | null
          current_location: string | null
          id: string
          installation_odometer: number | null
          notes: string | null
          pattern: string | null
          serial_number: string
          size: string | null
          status: string
          updated_at: string
          updated_by: string | null
          vehicle_id: string | null
          wheel_position: string | null
        }
        Insert: {
          brand?: string | null
          condition?: string | null
          created_at?: string
          created_by?: string | null
          current_location?: string | null
          id?: string
          installation_odometer?: number | null
          notes?: string | null
          pattern?: string | null
          serial_number: string
          size?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string | null
          wheel_position?: string | null
        }
        Update: {
          brand?: string | null
          condition?: string | null
          created_at?: string
          created_by?: string | null
          current_location?: string | null
          id?: string
          installation_odometer?: number | null
          notes?: string | null
          pattern?: string | null
          serial_number?: string
          size?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string | null
          wheel_position?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tires_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_financials: {
        Row: {
          advance_input_type: string
          advance_paid_tzs: number
          advance_paid_usd: number
          advance_value: number
          contract_amount: number
          contract_currency: string
          created_at: string
          created_by: string | null
          customer_paid_tzs: number
          fx_exchange_rate: number
          id: string
          total_contract_tzs: number | null
          trip_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          advance_input_type?: string
          advance_paid_tzs?: number
          advance_paid_usd?: number
          advance_value?: number
          contract_amount?: number
          contract_currency?: string
          created_at?: string
          created_by?: string | null
          customer_paid_tzs?: number
          fx_exchange_rate?: number
          id?: string
          total_contract_tzs?: number | null
          trip_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          advance_input_type?: string
          advance_paid_tzs?: number
          advance_paid_usd?: number
          advance_value?: number
          contract_amount?: number
          contract_currency?: string
          created_at?: string
          created_by?: string | null
          customer_paid_tzs?: number
          fx_exchange_rate?: number
          id?: string
          total_contract_tzs?: number | null
          trip_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_financials_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: true
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          audited_at: string | null
          contract_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          destination: string | null
          driver_id: string | null
          id: string
          invoice_id: string | null
          notes: string | null
          origin: string | null
          planned_arrival: string | null
          planned_departure: string | null
          planned_distance: number | null
          settled_at: string | null
          status: string
          trailer_id: string | null
          trip_number: string
          updated_at: string
          updated_by: string | null
          vehicle_id: string | null
        }
        Insert: {
          audited_at?: string | null
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          destination?: string | null
          driver_id?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          origin?: string | null
          planned_arrival?: string | null
          planned_departure?: string | null
          planned_distance?: number | null
          settled_at?: string | null
          status?: string
          trailer_id?: string | null
          trip_number: string
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string | null
        }
        Update: {
          audited_at?: string | null
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          destination?: string | null
          driver_id?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          origin?: string | null
          planned_arrival?: string | null
          planned_departure?: string | null
          planned_distance?: number | null
          settled_at?: string | null
          status?: string
          trailer_id?: string | null
          trip_number?: string
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trips_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_trailer_id_fkey"
            columns: ["trailer_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicle_inspections: {
        Row: {
          created_at: string
          created_by: string | null
          findings: string | null
          id: string
          inspected_at: string
          inspection_type: string | null
          inspector: string | null
          odometer: number | null
          result: string
          trip_id: string | null
          updated_at: string
          updated_by: string | null
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          findings?: string | null
          id?: string
          inspected_at?: string
          inspection_type?: string | null
          inspector?: string | null
          odometer?: number | null
          result?: string
          trip_id?: string | null
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          findings?: string | null
          id?: string
          inspected_at?: string
          inspection_type?: string | null
          inspector?: string | null
          odometer?: number | null
          result?: string
          trip_id?: string | null
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_inspections_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_inspections_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_maintenance: {
        Row: {
          completed_at: string | null
          cost_tzs: number
          created_at: string
          created_by: string | null
          description: string | null
          duration_hours: number | null
          id: string
          maintenance_date: string
          paid_amount: number
          status: string
          technician_id: string | null
          updated_at: string
          updated_by: string | null
          vehicle_id: string | null
        }
        Insert: {
          completed_at?: string | null
          cost_tzs?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_hours?: number | null
          id?: string
          maintenance_date?: string
          paid_amount?: number
          status?: string
          technician_id?: string | null
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string | null
        }
        Update: {
          completed_at?: string | null
          cost_tzs?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_hours?: number | null
          id?: string
          maintenance_date?: string
          paid_amount?: number
          status?: string
          technician_id?: string | null
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_maintenance_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_maintenance_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          assigned_driver: string | null
          capacity: string | null
          created_at: string
          created_by: string | null
          documents_expiry: string | null
          id: string
          is_trailer: boolean
          notes: string | null
          odometer: number | null
          registration_number: string
          status: string
          updated_at: string
          updated_by: string | null
          vehicle_type: string | null
          yard_zone: string | null
        }
        Insert: {
          assigned_driver?: string | null
          capacity?: string | null
          created_at?: string
          created_by?: string | null
          documents_expiry?: string | null
          id?: string
          is_trailer?: boolean
          notes?: string | null
          odometer?: number | null
          registration_number: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          vehicle_type?: string | null
          yard_zone?: string | null
        }
        Update: {
          assigned_driver?: string | null
          capacity?: string | null
          created_at?: string
          created_by?: string | null
          documents_expiry?: string | null
          id?: string
          is_trailer?: boolean
          notes?: string | null
          odometer?: number | null
          registration_number?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          vehicle_type?: string | null
          yard_zone?: string | null
        }
        Relationships: []
      }
      work_orders: {
        Row: {
          actual_cost: number | null
          cost_estimate: number | null
          created_at: string
          created_by: string | null
          handover_condition: string | null
          id: string
          notes: string | null
          odometer: number | null
          planned_work: string | null
          priority: string | null
          released_verified_by: string | null
          reported_defect: string | null
          status: string
          technician: string | null
          updated_at: string
          updated_by: string | null
          vehicle_id: string | null
          work_order_number: string
        }
        Insert: {
          actual_cost?: number | null
          cost_estimate?: number | null
          created_at?: string
          created_by?: string | null
          handover_condition?: string | null
          id?: string
          notes?: string | null
          odometer?: number | null
          planned_work?: string | null
          priority?: string | null
          released_verified_by?: string | null
          reported_defect?: string | null
          status?: string
          technician?: string | null
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string | null
          work_order_number: string
        }
        Update: {
          actual_cost?: number | null
          cost_estimate?: number | null
          created_at?: string
          created_by?: string | null
          handover_condition?: string | null
          id?: string
          notes?: string | null
          odometer?: number | null
          planned_work?: string | null
          priority?: string | null
          released_verified_by?: string | null
          reported_defect?: string | null
          status?: string
          technician?: string | null
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string | null
          work_order_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      yard_movements: {
        Row: {
          created_at: string
          created_by: string | null
          from_zone: string | null
          id: string
          moved_at: string
          reason: string | null
          to_zone: string | null
          trip_id: string | null
          updated_at: string
          updated_by: string | null
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          from_zone?: string | null
          id?: string
          moved_at?: string
          reason?: string | null
          to_zone?: string | null
          trip_id?: string | null
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          from_zone?: string | null
          id?: string
          moved_at?: string
          reason?: string | null
          to_zone?: string | null
          trip_id?: string | null
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "yard_movements_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yard_movements_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      yard_zones: {
        Row: {
          active: boolean
          capacity: number | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          capacity?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          capacity?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "operations_manager"
        | "dispatcher"
        | "finance_officer"
        | "yard_supervisor"
        | "gate_security"
        | "loading_officer"
        | "fuel_attendant"
        | "maintenance_manager"
        | "technician"
        | "security_investigator"
        | "auditor"
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
      app_role: [
        "admin",
        "operations_manager",
        "dispatcher",
        "finance_officer",
        "yard_supervisor",
        "gate_security",
        "loading_officer",
        "fuel_attendant",
        "maintenance_manager",
        "technician",
        "security_investigator",
        "auditor",
      ],
    },
  },
} as const
