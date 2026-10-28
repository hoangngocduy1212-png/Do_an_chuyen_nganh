export interface MembershipLevel {
  name: string;
  minPoints: number;
  benefits: string;
}

export interface MembershipSummary {
  pointBalance: number;
  memberLevel: string;
  memberCode: string;
  lifetimePoints: number;
  levels: MembershipLevel[];
}

export interface PointHistoryItem {
  id: string;
  description: string;
  points: number;
  createdAt: string;
  balanceAfter: number;
}

export interface PointTransactionsPage {
  items: PointHistoryItem[];
  page: number;
  limit: number;
  total: number;
}