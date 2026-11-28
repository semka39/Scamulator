export type TemkaStatus = 'Active' | 'Bankrupt' | 'Closed';

export interface User {
  id: string;
  username: string;
  passwordHash: string; // plain for demo convenience or sha256
  balance: number;
  createdAt: string;
  avatarUrl?: string;
  bio?: string;
  isBanned?: boolean;
  banReason?: string;
}

export interface Temka {
  id: string;
  ownerId: string;
  ownerUsername: string;
  ownerAvatarUrl?: string;
  title: string;
  description: string;
  algorithmCode: string;
  collateral: number;
  initialCapital: number;
  capital: number;
  minBet: number;
  maxBet: number;
  status: TemkaStatus;
  createdAt: string;
  updatedAt: string;
  
  // Dynamic statistics
  totalIn: number;
  totalOut: number;
  dealsCount: number;
  maxMultiplier: number;
  minMultiplier: number;
  
  // State metadata
  hasStateFile?: boolean;
}

export interface Transaction {
  id: string;
  temkaId: string;
  userId: string;
  userHash: string; // pseudo-anonymized hash for sandbox & display
  amount: number;
  payout: number;
  multiplier: number; // rounded to 2 decimals for feed
  isDefault: boolean; // default/bankruptcy trigger
  isRefund: boolean; // script crash/timeout refund
  timestamp: string;
}

export interface WithdrawalRequest {
  id: string;
  temkaId: string;
  ownerId: string;
  amount: number;
  claimCollateralAndClose: boolean;
  status: 'PENDING' | 'EXECUTED' | 'CANCELLED';
  createdAt: string;
  executedAt?: string;
  depositsSinceRequest: number; // target: 10 unique deposits
  uniqueDepositors: string[]; // user IDs of depositors since request
  deadlineAt: string; // 48h from creation
}

export interface PastWithdrawal {
  id: string;
  temkaId: string;
  amount: number;
  claimedCollateral: boolean;
  timestamp: string;
}

export interface Comment {
  id: string;
  temkaId: string;
  userId: string;
  username: string;
  userAvatarUrl?: string;
  text: string;
  createdAt: string;
  likes: string[]; // user IDs who liked
  
  // Proof-of-Bet immutable badge snapshot
  userStats: {
    roundedTotalBets: number;
    roundedTotalPayouts: number;
    exactRoiMultiplier: number; // e.g. 1.45
    colorCode: 'green' | 'gray' | 'red';
  };
}

export interface SandboxLog {
  id: string;
  temkaId: string;
  timestamp: string;
  durationMs: number;
  depositAmount: number;
  userHash: string;
  payout: number;
  stdout: string;
  stderr: string;
  error?: string;
  status: 'SUCCESS' | 'TIMEOUT' | 'ERROR';
}

export interface Transfer {
  id: string;
  senderId: string;
  senderUsername: string;
  recipientId: string;
  recipientUsername: string;
  amount: number;
  comment?: string;
  timestamp: string;
}

export interface Invoice {
  id: string;
  userId: string;
  username: string;
  amount: number;
  uniqueAmount?: number;
  amountWithCommission?: number;
  bank: string;
  paymentUrl?: string;
  status: 'active' | 'paid' | 'expired' | 'cancelled';
  createdAt: string;
  expiresAt?: string;
  secondsLeft?: number;
  credited: boolean;
}

export interface PromoCode {
  code: string;
  amount: number;
  maxActivations: number;
  usedCount: number;
  createdAt: string;
}

export interface PromoActivation {
  id: string;
  promoCode: string;
  userId: string;
  username: string;
  amount: number;
  activatedAt: string;
}

export type NotificationType =
  | 'new_bet'
  | 'temka_bankrupt'
  | 'temka_closed'
  | 'withdrawal_executed'
  | 'new_comment'
  | 'transfer_received';

export interface NotificationSettings {
  new_bet: boolean;
  temka_bankrupt: boolean;
  temka_closed: boolean;
  withdrawal_executed: boolean;
  new_comment: boolean;
  transfer_received: boolean;
}

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  temkaId?: string;
  relatedUserId?: string;
  isRead: boolean;
  createdAt: string;
}

export interface DatabaseSchema {
  users: User[];
  temkas: Temka[];
  transactions: Transaction[];
  withdrawalRequests: WithdrawalRequest[];
  pastWithdrawals: PastWithdrawal[];
  comments: Comment[];
  sandboxLogs: SandboxLog[];
  transfers?: Transfer[];
  invoices?: Invoice[];
  promoCodes?: PromoCode[];
  promoActivations?: PromoActivation[];
}
