export type TemkaStatus = 'Active' | 'Bankrupt' | 'Closed';

export interface User {
  id: string;
  username: string;
  balance: number;
  createdAt: string;
  avatarUrl?: string;
  bio?: string;
  rank?: number;
  isBanned?: boolean;
  banReason?: string;
}

export interface LeaderboardUser extends User {
  rank: number;
  temkasCount?: number;
}

export interface LeaderboardResponse {
  users: LeaderboardUser[];
  totalUsers: number;
  page: number;
  pageSize: number;
  totalPages: number;
  currentUserRank?: {
    rank: number;
    page: number;
  };
}

export interface Temka {
  id: string;
  ownerId: string;
  ownerUsername: string;
  ownerAvatarUrl?: string;
  title: string;
  description: string;
  algorithmCode?: string;
  collateral: number;
  initialCapital: number;
  capital: number;
  minBet: number;
  maxBet: number;
  status: TemkaStatus;
  createdAt: string;
  updatedAt: string;
  
  totalIn: number;
  totalOut: number;
  dealsCount: number;
  maxMultiplier: number;
  minMultiplier: number;
  rtp?: number;
  hasStateFile?: boolean;
  
  activeWithdrawalAmount?: number;
  activeWithdrawalRatio?: number;
  depositsLeftForWithdrawal?: number | null;
}

export interface TransactionSummary {
  id: string;
  multiplier: number;
  isDefault: boolean;
  isRefund: boolean;
  timestamp: string;
}

export interface WithdrawalRequestInfo {
  id: string;
  amount: number;
  claimCollateralAndClose: boolean;
  depositsSinceRequest: number;
  depositsRemaining: number;
  deadlineAt: string;
  createdAt: string;
}

export interface PastWithdrawal {
  id: string;
  temkaId: string;
  amount: number;
  claimedCollateral: boolean;
  timestamp: string;
}

export interface CommentUserStats {
  roundedTotalBets: number;
  roundedTotalPayouts: number;
  exactRoiMultiplier: number;
  colorCode: 'green' | 'gray' | 'red';
}

export interface Comment {
  id: string;
  temkaId: string;
  userId: string;
  username: string;
  userAvatarUrl?: string;
  text: string;
  createdAt: string;
  likes: string[];
  userStats: CommentUserStats;
}

export interface SimulationRoundResult {
  round: number;
  bet: number;
  payout: number;
  multiplier: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  capitalAfter: number;
}

export interface SimulationResult {
  status: 'SUCCESS' | 'TIMEOUT' | 'ERROR';
  payout: number;
  totalIn: number;
  totalOut: number;
  avgMultiplier: number;
  maxMultiplier: number;
  minMultiplier: number;
  durationMs: number;
  stdout: string;
  stderr: string;
  error?: string;
  rounds: SimulationRoundResult[];
  finalState?: any;
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

export interface CreatorMetrics {
  totalTemkas: number;
  activeCount: number;
  successfulClosedCount: number;
  bankruptCount: number;
  totalCapitalRaised: number;
  totalPayoutsGiven: number;
  overallPayoutRate: number;
}

export interface FilterState {
  search: string;
  status: string[]; // ['Active', 'Bankrupt', 'Closed']
  minCapital: string;
  maxCapital: string;
  minCollateral: string;
  maxCollateral: string;
  minBet?: string;
  maxBet?: string;
  minBetMin?: string;
  minBetMax?: string;
  maxBetMin?: string;
  maxBetMax?: string;
  minTotalIn?: string;
  maxTotalIn?: string;
  minTotalOut?: string;
  maxTotalOut?: string;
  minRtp?: string;
  maxRtp?: string;
  minDeals?: string;
  maxDeals?: string;
  minWithdrawalRatio?: string;
  maxWithdrawalRatio?: string;
  maxAgeHours?: string;
  sortBy: 'capital' | 'rtp' | 'deals' | 'createdAt' | 'withdrawalVolume';
  sortDir: 'asc' | 'desc';
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

export type BalanceCategory = 'all' | 'investments' | 'temkas' | 'transfers' | 'deposits';
export type BalanceDirection = 'all' | 'income' | 'expense';

export interface BalanceHistoryItem {
  id: string;
  category: 'investments' | 'temkas' | 'transfers' | 'deposits';
  direction: 'income' | 'expense' | 'neutral';
  type: 'transfer_in' | 'transfer_out' | 'deposit' | 'investment' | 'temka_create' | 'temka_topup' | 'temka_withdraw';
  title: string;
  subtext?: string;
  amount?: number;
  
  // Specific for investments/bets:
  isInvestment?: boolean;
  temkaId?: string;
  temkaTitle?: string;
  betAmount?: number;
  payout?: number;
  delta?: number;
  multiplier?: number;
  isDefault?: boolean;
  isRefund?: boolean;
  
  comment?: string;
  timestamp: string;
}

