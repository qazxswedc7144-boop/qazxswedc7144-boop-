// src/types/auth.types.ts
import { SyncableEntity } from "./common.types";

export type UserRole = 'Admin' | 'Accountant' | 'Clerk';

export interface User extends SyncableEntity {
  user_id: string;
  User_Email: string; 
  User_Name: string;
  Role: UserRole;
  Is_Active: boolean;
  tenant_id: string;
  lastLogin?: string;
  password_hash?: string;
  salt?: string;
  created_at?: string;
}

export interface UserRoleEntry extends SyncableEntity {
  User_Email: string;
  Role_Type: UserRole;
}

export type Permission = 
  | 'CREATE_INVOICE' 
  | 'EDIT_INVOICE' 
  | 'DELETE_INVOICE'
  | 'CREATE_VOUCHER'
  | 'EDIT_VOUCHER'
  | 'DELETE_VOUCHER'
  | 'VIEW_REPORTS'
  | 'FINANCIAL_ACCESS'
  | 'MANAGE_SYSTEM'
  | 'FULL_ACCESS'
  | 'POS_ACCESS'
  | 'PURCHASE_ACCESS'
  | 'INVENTORY_VIEW'
  | 'MANAGE_PARTNERS'
  | 'AUDIT_VIEW'
  | 'ARCHIVE_VIEW';
