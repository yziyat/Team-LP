
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

export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
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
  employeeId?: number; // Link to an employee profile (for Team Leaders)
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
  absenceTypes: string[]; // New field for absence reasons
  holidays: Holiday[]; // New field for public holidays
  dateFormat: string;
  language: 'fr' | 'en';
}

export interface PlanningData {
  [key: string]: string; // key is "employeeId_YYYY-MM-DD", value is shiftName
}

export type TabName = 'home' | 'dashboard' | 'employees' | 'planning' | 'settings' | 'users' | 'bonus' | 'audit';

export type TranslationKey = 
  | 'home' | 'dashboard' | 'employees' | 'planning' | 'settings' | 'users' | 'bonus' | 'audit'
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
  | 'rows_per_page' | 'all' | 'showing_range' | 'filter_action' | 'filter_user' | 'filter_date' | 'start_date' | 'end_date';