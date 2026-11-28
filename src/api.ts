import {
  User,
  Temka,
  TransactionSummary,
  WithdrawalRequestInfo,
  PastWithdrawal,
  Comment,
  SandboxLog,
  CreatorMetrics,
  FilterState,
  Transfer,
  Invoice,
  BalanceHistoryItem,
  LeaderboardResponse,
  AppNotification,
  NotificationSettings,
} from './types';

const TOKEN_KEY = 'temshchik_auth_token';
const GATE_KEY = 'scam_gate_pass';

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  document.cookie = `scam_auth_token=${encodeURIComponent(token)}; path=/; max-age=2592000; SameSite=Lax`;
  document.cookie = `scam_auth_token=${encodeURIComponent(token)}; path=/; max-age=2592000; SameSite=None; Secure`;
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  document.cookie = `scam_auth_token=; path=/; max-age=0; SameSite=Lax`;
  document.cookie = `scam_auth_token=; path=/; max-age=0; SameSite=None; Secure`;
  fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
}

export function getGatePass(): string | null {
  return localStorage.getItem(GATE_KEY);
}

export function setGatePass(token: string): void {
  localStorage.setItem(GATE_KEY, token);
  document.cookie = `scam_gate_pass=${encodeURIComponent(token)}; path=/; max-age=86400; SameSite=Lax`;
  document.cookie = `scam_gate_pass=${encodeURIComponent(token)}; path=/; max-age=86400; SameSite=None; Secure`;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MAX_RETRIES = 3;

async function request<T>(endpoint: string, options: RequestInit = {}, retries = 0): Promise<T> {
  const token = getAuthToken();
  const gatePass = getGatePass();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (gatePass) {
    headers['X-Gate-Pass'] = gatePass;
  }

  const isReadMethod = !options.method || options.method === 'GET' || options.method === 'HEAD';

  try {
    const response = await fetch(`/api${endpoint}`, {
      ...options,
      headers,
    });

    // If server rate limits or temporary network gateway error
    if ((response.status === 429 || response.status >= 502) && isReadMethod && retries < MAX_RETRIES) {
      const backoffDelay = Math.min(1000 * Math.pow(2, retries) + Math.random() * 400, 8000);
      await sleep(backoffDelay);
      return request<T>(endpoint, options, retries + 1);
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'Произошла ошибка при выполнении запроса');
    }
    return data as T;
  } catch (error: any) {
    // Retry on network drops or fetch aborts for read methods
    const isNetworkError = error instanceof TypeError || error.name === 'AbortError' || error.message?.includes('network');
    if (isNetworkError && isReadMethod && retries < MAX_RETRIES) {
      const backoffDelay = Math.min(1000 * Math.pow(2, retries) + Math.random() * 400, 8000);
      await sleep(backoffDelay);
      return request<T>(endpoint, options, retries + 1);
    }
    throw error;
  }
}

export const api = {
  // Auth
  getMe: () => request<{ user: User }>('/auth/me'),
  getCurrentUser: async (): Promise<User | null> => {
    try {
      const res = await request<{ user: User }>('/auth/me');
      return res.user;
    } catch {
      return null;
    }
  },
  getUsersList: () => request<{ users: User[] }>('/users'),
  login: async (username: string, password: string) => {
    const res = await request<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setAuthToken(res.token);
    return res;
  },
  register: async (username: string, password: string, captchaToken?: string) => {
    const res = await request<{ user: User; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, captchaToken }),
    });
    setAuthToken(res.token);
    return res;
  },
  logout: async () => {
    clearAuthToken();
  },

  // Notifications
  getNotifications: () =>
    request<{ notifications: AppNotification[]; unreadCount: number }>('/notifications'),
  markNotificationsRead: (notificationId?: string) =>
    request<{ success: boolean; unreadCount: number }>('/notifications/read', {
      method: 'POST',
      body: JSON.stringify({ notificationId }),
    }),
  deleteNotification: (notificationId: string) =>
    request<{ success: boolean; unreadCount: number }>(`/notifications/${notificationId}`, {
      method: 'DELETE',
    }),
  clearNotifications: () =>
    request<{ success: boolean; unreadCount: number }>('/notifications', {
      method: 'DELETE',
    }),
  getNotificationSettings: () =>
    request<{ settings: NotificationSettings }>('/notifications/settings'),
  updateNotificationSettings: (settings: Partial<NotificationSettings>) =>
    request<{ success: boolean; settings: NotificationSettings }>('/notifications/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),

  // Transfers
  transfer: (recipientUsername: string, amount: number, comment?: string) =>
    request<{ success: boolean; message: string; transfer: Transfer; newBalance: number }>('/transfers', {
      method: 'POST',
      body: JSON.stringify({ recipientUsername, amount, comment }),
    }),
  getTransfers: () => request<{ transfers: Transfer[] }>('/transfers'),
  getBalanceHistory: () => request<{ items: BalanceHistoryItem[] }>('/users/me/balance-history'),

  // Deposit (Argon Pay)
  createDepositInvoice: (amount: number, method: 'ozon' | 'sbp') =>
    request<{ success: boolean; invoice: Invoice; displayMethod: string }>('/deposit/create', {
      method: 'POST',
      body: JSON.stringify({ amount, method }),
    }),
  checkDepositInvoice: (invoiceId: string) =>
    request<{ status: string; invoice: Invoice; justCredited: boolean; newBalance: number; message?: string }>(
      `/deposit/check/${invoiceId}`
    ),
  getDepositInvoices: () => request<{ invoices: Invoice[] }>('/deposit/invoices'),

  // Promo Codes
  applyPromoCode: (code: string) =>
    request<{ success: boolean; amount: number; newBalance: number; message: string }>('/promo/apply', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  // Profiles & Leaderboard
  getPublicProfile: (userId: string) =>
    request<{ user: User; metrics: CreatorMetrics; temkas: Temka[] }>(`/users/${userId}/public`),
  getLeaderboard: (params?: { page?: number; pageSize?: number; search?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.pageSize) searchParams.append('pageSize', String(params.pageSize));
    if (params?.search) searchParams.append('search', params.search);
    const qs = searchParams.toString();
    return request<LeaderboardResponse>(`/leaderboard${qs ? `?${qs}` : ''}`);
  },
  getPrivateDashboard: () =>
    request<{
      user: User;
      metrics: CreatorMetrics;
      myTemkas: Temka[];
      activeWithdrawalRequests: any[];
    }>('/users/me/dashboard'),
  updateProfile: (data: { bio?: string; avatarUrl?: string }) =>
    request<{ user: User; message: string }>('/users/me/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Temkas
  getTemkas: (filters?: Partial<FilterState>) => {
    const params = new URLSearchParams();
    if (filters) {
      if (filters.search) params.append('search', filters.search);
      if (filters.status && filters.status.length > 0) params.append('status', filters.status.join(','));
      if (filters.minCapital) params.append('minCapital', filters.minCapital);
      if (filters.maxCapital) params.append('maxCapital', filters.maxCapital);
      if (filters.minCollateral) params.append('minCollateral', filters.minCollateral);
      if (filters.maxCollateral) params.append('maxCollateral', filters.maxCollateral);
      if (filters.minBetMin) params.append('minBetMin', filters.minBetMin);
      if (filters.minBetMax) params.append('minBetMax', filters.minBetMax);
      if (filters.maxBetMin) params.append('maxBetMin', filters.maxBetMin);
      if (filters.maxBetMax) params.append('maxBetMax', filters.maxBetMax);
      if (filters.minTotalIn) params.append('minTotalIn', filters.minTotalIn);
      if (filters.maxTotalIn) params.append('maxTotalIn', filters.maxTotalIn);
      if (filters.minTotalOut) params.append('minTotalOut', filters.minTotalOut);
      if (filters.maxTotalOut) params.append('maxTotalOut', filters.maxTotalOut);
      if (filters.minRtp) params.append('minRtp', filters.minRtp);
      if (filters.maxRtp) params.append('maxRtp', filters.maxRtp);
      if (filters.minDeals) params.append('minDeals', filters.minDeals);
      if (filters.maxDeals) params.append('maxDeals', filters.maxDeals);
      if (filters.minWithdrawalRatio) params.append('minWithdrawalRatio', filters.minWithdrawalRatio);
      if (filters.maxWithdrawalRatio) params.append('maxWithdrawalRatio', filters.maxWithdrawalRatio);
      if (filters.maxAgeHours) params.append('maxAgeHours', filters.maxAgeHours);
      if (filters.sortBy) params.append('sortBy', filters.sortBy);
      if (filters.sortDir) params.append('sortDir', filters.sortDir);
    }
    const query = params.toString();
    return request<{ temkas: Temka[] }>(`/temkas${query ? `?${query}` : ''}`);
  },

  getTemkaDetails: (temkaId: string) =>
    request<{
      temka: Temka;
      activeWithdrawal: WithdrawalRequestInfo | null;
      pastWithdrawals: PastWithdrawal[];
      transactions: TransactionSummary[];
      userContext: {
        isOwner: boolean;
        canBet: boolean;
        hasUserDeposited: boolean;
        userStats: any;
        myTransactions?: Array<{
          id: string;
          amount: number;
          payout: number;
          multiplier: number;
          isDefault: boolean;
          isRefund: boolean;
          timestamp: string;
        }>;
      };
    }>(`/temkas/${temkaId}`),

  createTemka: (payload: {
    title: string;
    description: string;
    algorithmCode: string;
    collateral: number;
    initialCapital: number;
    minBet: number;
    maxBet: number;
  }) => request<{ temka: Temka; message: string }>('/temkas', { method: 'POST', body: JSON.stringify(payload) }),

  testAlgorithm: (payload: {
    algorithmCode: string;
    betAmount?: number;
    initialCapital?: number;
    rounds?: number;
  }) =>
    request<import('./types').SimulationResult>('/temkas/test', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Betting
  makeBet: (temkaId: string, amount: number) =>
    request<{
      transaction: TransactionSummary;
      payout: number;
      userBalance: number;
      temkaCapital: number;
      temkaStatus: string;
      isDefault: boolean;
      isRefund: boolean;
      message: string;
      stdout?: string;
      stderr?: string;
    }>(`/temkas/${temkaId}/bet`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),

  // Owner Operations
  topUpCapital: (temkaId: string, amount: number) =>
    request<{ message: string; temkaCapital: number; userBalance: number }>(`/temkas/${temkaId}/topup`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),

  createWithdrawalRequest: (temkaId: string, amount: number, claimCollateralAndClose: boolean) =>
    request<{ request: any; message: string }>(`/temkas/${temkaId}/withdrawal-request`, {
      method: 'POST',
      body: JSON.stringify({ amount, claimCollateralAndClose }),
    }),

  cancelWithdrawalRequest: (temkaId: string) =>
    request<{ message: string }>(`/temkas/${temkaId}/withdrawal-request`, {
      method: 'DELETE',
    }),

  executeWithdrawal: (temkaId: string) =>
    request<{ message: string; userBalance: number; temkaCapital: number; temkaStatus: string }>(
      `/temkas/${temkaId}/execute-withdrawal`,
      { method: 'POST' }
    ),

  updateTemkaMetadata: (temkaId: string, payload: { title: string; description: string }) =>
    request<{ temka: Temka; message: string }>(`/temkas/${temkaId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteTemka: (temkaId: string) =>
    request<{ message: string }>(`/temkas/${temkaId}`, {
      method: 'DELETE',
    }),

  getSandboxLogs: (temkaId: string) =>
    request<{ logs: SandboxLog[] }>(`/temkas/${temkaId}/logs`),

  // Proof-of-Bet Comments & Likes
  getComments: (temkaId: string, sortBy: 'date' | 'likes' = 'date') =>
    request<{ comments: Comment[] }>(`/temkas/${temkaId}/comments?sortBy=${sortBy}`),

  postComment: (temkaId: string, text: string) =>
    request<{ comment: Comment; message: string }>(`/temkas/${temkaId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  likeComment: (temkaId: string, commentId: string) =>
    request<{ likes: string[]; likesCount: number }>(`/temkas/${temkaId}/comments/${commentId}/like`, {
      method: 'POST',
    }),
};
