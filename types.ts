
export interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  matricule: string;
  birthDate: string;
  category: string;
  assignment: string;
  defaultShift?: string;
  teamId?: number;
  teamFunction?: string;
  isBonusEligible?: boolean;
  exitDate?: string | null;
  entryDate?: string; // New field for entry date
}

export interface Shift {
  name: string;
  start: string;
  end: string;
  color: string;
}

export interface AbsenceType {
  name: string;
  color: string;
}

export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
  type: 'civil' | 'religious';
}

export interface Team {
  id: number;
  name: string;
  leaderId: number | string;
  members: number[]; // Array of Employee IDs
}

export interface Bonus {
  id: string; // Composite key: employeeId_YYYY-MM
  employeeId: number;
  month: string; // Format YYYY-MM
  amount: number; // The score/note
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer' | 'manager';
  active: boolean;
  emailVerified?: boolean; // New field to track email verification status in Firestore
  employeeId?: number | null; // Link to an employee profile (for Team Leaders). Nullable to allow clearing.
}

export interface TrainingParticipant {
  employeeId: number;
  present: boolean;
}

export interface Training {
  id: number;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  sessionCount: number;
  sessionDates: string[];
  targetTeamIds: number[];
  status: 'planned' | 'in_progress' | 'validated' | 'archived';
  participants: TrainingParticipant[];
}

export interface AuditLogEntry {
  id: number;
  timestamp: string;
  action: string;
  details: string;
  user: string;
}

export interface AppSettings {
  categories: string[];
  shifts: Shift[];
  assignments: string[];
  absenceTypes: AbsenceType[]; // Updated to object with color
  holidays: Holiday[]; 
  dateFormat: string;
  language: 'fr' | 'en';
}

export interface PlanningData {
  [key: string]: string; // key is "employeeId_YYYY-MM-DD", value is shiftName
}

export interface Notification {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

export type TabName = 'home' | 'dashboard' | 'employees' | 'planning' | 'settings' | 'users' | 'bonus' | 'audit' | 'training';

export type TranslationKey = 
  | 'home' | 'dashboard' | 'employees' | 'planning' | 'settings' | 'users' | 'bonus' | 'audit' | 'training'
  | 'logout' | 'search' | 'new_employee' | 'filter_category' | 'filter_employee' | 'filter_team'
  | 'stats_total' | 'stats_present' | 'stats_absent'
  | 'welcome_title' | 'welcome_subtitle'
  | 'quick_access' | 'recent_activity'
  | 'general_settings' | 'app_data' | 'teams'
  | 'save' | 'cancel' | 'delete' | 'edit' | 'add' | 'create' | 'reset' | 'update'
  | 'bonus_management' | 'bonus_eligible' | 'score' | 'select_team'
  | 'audit_title' | 'audit_subtitle' | 'action' | 'date' | 'details' | 'user'
  | 'edit_team' | 'create_team' | 'team_name' | 'team_leader' | 'team_members'
  | 'exit_date' | 'entry_date' | 'exit_management' | 'set_exit_date' | 'active_status'
  | 'holidays' | 'absence_types' | 'history' | 'filter_name_code'
  | 'rows_per_page' | 'all' | 'showing_range' | 'filter_action' | 'filter_user' | 'filter_date' | 'start_date' | 'end_date'
  | 'view_calendar' | 'view_grid' | 'export_pdf' | 'export_image' | 'color'
  | 'error_entry_before_birth' | 'error_exit_before_birth' | 'error_exit_before_entry'
  | 'export' | 'assign_to'
  | 'status_planned' | 'status_in_progress' | 'status_validated' | 'status_archived'
  | 'training_title' | 'training_sessions' | 'training_target' | 'training_participants' | 'training_attendance'
  | 'manage_participants' | 'mark_attendance' | 'validate_step' | 'archive' | 'back_step'
  | 'training_dashboard' | 'beneficiaries' | 'training_history' | 'attendees'
  | 'verify_email_title' | 'verify_email_desc' | 'resend_email' | 'email_sent';
