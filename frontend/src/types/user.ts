import type { AuthUser } from './index';

export interface MembershipSummary {
  pointBalance: number;
  memberLevel: string;
}

export type CustomerUser = AuthUser & { defaultAddress?: string };