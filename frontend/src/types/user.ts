import type { AuthUser } from './index';

export interface MembershipSummary {
  pointBalance: number;
  memberLevel: string;
  memberCode?: string;
  lifetimePoints?: number;
  levels?: { name: string; minPoints: number; benefits: string }[];
}

export interface UserProfile extends AuthUser {
  phoneNumber?: string;
  createdAt?: string;
  defaultAddress?: string;
  avatarUrl?: string;
}

export type CustomerUser = UserProfile;