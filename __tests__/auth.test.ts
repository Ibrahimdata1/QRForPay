// ─── mocks (must be before any imports) ──────────────────────────────────────

// expo-notifications pulls in expo-constants → expo-modules-core (native).
// We mock the whole chain to prevent native module resolution errors.
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: (...args: any[]) => mockGetPermissionsAsync(...args),
  requestPermissionsAsync: (...args: any[]) => mockRequestPermissionsAsync(...args),
  getExpoPushTokenAsync: (...args: any[]) => mockGetExpoPushTokenAsync(...args),
}));

jest.mock('expo-constants', () => ({
  default: { expoConfig: { extra: {} } },
}));

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: any[]) => mockGetSession(...args),
      signInWithPassword: (...args: any[]) => mockSignInWithPassword(...args),
      signOut: (...args: any[]) => mockSignOut(...args),
    },
    from: (...args: any[]) => mockFrom(...args),
  },
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

// ─── mock fn declarations ─────────────────────────────────────────────────────

const mockGetPermissionsAsync = jest.fn();
const mockRequestPermissionsAsync = jest.fn();
const mockGetExpoPushTokenAsync = jest.fn();

const mockGetSession = jest.fn();
const mockSignInWithPassword = jest.fn();
const mockSignOut = jest.fn();

// Supabase query-builder mocks
const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockSingle = jest.fn();
const mockUpdate = jest.fn();

// ─── real imports ─────────────────────────────────────────────────────────────
import { useAuthStore } from '../src/store/authStore';
import { Profile, Shop } from '../src/types';

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'user-1',
    email: 'test@example.com',
    full_name: 'Test User',
    role: 'owner',
    shop_id: 'shop-1',
    push_token: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeShop(overrides: Partial<Shop> = {}): Shop {
  return {
    id: 'shop-1',
    name: 'Test Shop',
    promptpay_id: '0812345678',
    tax_rate: 0.07,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Set up the supabase from() chain.
 * The chain looks like:
 *   from('profiles').select('*').eq('id', uid).single()  → { data, error }
 *   from('shops').select('*').eq('id', sid).single()     → { data, error }
 *   from('profiles').update({push_token}).eq('id', uid)  → { error }
 *
 * We wire: mockEq returns an object with .single (for selects) and resolves
 * directly (for updates). mockSingle returns the final promise.
 * mockUpdate returns an object whose .eq resolves a promise.
 */
function buildEqForSelect() {
  return { single: mockSingle };
}

function buildEqForUpdate() {
  return Promise.resolve({ error: null });
}

function setupFromChain() {
  // select chain: select().eq().single()
  mockSelect.mockReturnValue({ eq: jest.fn().mockReturnValue({ single: mockSingle }) });

  // update chain: update().eq()  → resolves { error: null }
  const updateEq = jest.fn().mockResolvedValue({ error: null });
  mockUpdate.mockReturnValue({ eq: updateEq });

  mockFrom.mockImplementation((table: string) => ({
    select: mockSelect,
    update: mockUpdate,
  }));
}

function resetStore() {
  useAuthStore.setState({
    user: null,
    profile: null,
    shop: null,
    isLoading: false,
    isInitialized: false,
  });
}

// ─── initialize ───────────────────────────────────────────────────────────────

describe('AuthStore — initialize', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupFromChain();
    resetStore();
    mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[xxx]' });
  });

  test('active session: sets user + profile + shop, isInitialized=true', async () => {
    const profile = makeProfile();
    const shop = makeShop();

    mockGetSession.mockResolvedValueOnce({
      data: { session: { user: { id: 'user-1', email: 'test@example.com' } } },
    });
    // profiles single, shops single
    mockSingle
      .mockResolvedValueOnce({ data: profile, error: null })
      .mockResolvedValueOnce({ data: shop, error: null });

    await useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.user).toEqual({ id: 'user-1', email: 'test@example.com' });
    expect(state.profile?.id).toBe('user-1');
    expect(state.shop?.id).toBe('shop-1');
    expect(state.isInitialized).toBe(true);
    expect(state.isLoading).toBe(false);
  });

  test('no session: user=null, isInitialized=true, isLoading=false', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } });

    await useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isInitialized).toBe(true);
    expect(state.isLoading).toBe(false);
  });

  test('session with no shop_id: shop stays null', async () => {
    const profileNoShop = makeProfile({ shop_id: '' });

    mockGetSession.mockResolvedValueOnce({
      data: { session: { user: { id: 'user-1', email: 'test@example.com' } } },
    });
    mockSingle.mockResolvedValueOnce({ data: profileNoShop, error: null });

    await useAuthStore.getState().initialize();

    expect(useAuthStore.getState().shop).toBeNull();
    expect(useAuthStore.getState().isInitialized).toBe(true);
  });

  test('exception in getSession: isInitialized=true, user=null (error swallowed)', async () => {
    mockGetSession.mockRejectedValueOnce(new Error('Network error'));

    await useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.isInitialized).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(state.user).toBeNull();
  });
});

// ─── signIn ───────────────────────────────────────────────────────────────────

describe('AuthStore — signIn', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupFromChain();
    resetStore();
    mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[yyy]' });
  });

  test('success: sets user, profile, and shop in state', async () => {
    const profile = makeProfile();
    const shop = makeShop();

    mockSignInWithPassword.mockResolvedValueOnce({
      data: { user: { id: 'user-1', email: 'test@example.com' } },
      error: null,
    });
    mockSingle
      .mockResolvedValueOnce({ data: profile, error: null })  // profile
      .mockResolvedValueOnce({ data: shop, error: null });     // shop

    await useAuthStore.getState().signIn('test@example.com', 'password123');

    const state = useAuthStore.getState();
    expect(state.user).toEqual({ id: 'user-1', email: 'test@example.com' });
    expect(state.profile?.role).toBe('owner');
    expect(state.shop?.name).toBe('Test Shop');
    expect(state.isLoading).toBe(false);
  });

  test('success with no shop_id: shop stays null', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      data: { user: { id: 'user-1', email: 'test@example.com' } },
      error: null,
    });
    mockSingle.mockResolvedValueOnce({ data: makeProfile({ shop_id: '' }), error: null });

    await useAuthStore.getState().signIn('test@example.com', 'password123');

    expect(useAuthStore.getState().shop).toBeNull();
  });

  test('auth error: throws the error and resets isLoading', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Invalid credentials' },
    });

    await expect(
      useAuthStore.getState().signIn('bad@email.com', 'wrong')
    ).rejects.toMatchObject({ message: 'Invalid credentials' });

    expect(useAuthStore.getState().isLoading).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });

  test('profile fetch error: throws and resets isLoading', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      data: { user: { id: 'user-1', email: 'test@example.com' } },
      error: null,
    });
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'profile not found' } });

    await expect(
      useAuthStore.getState().signIn('test@example.com', 'password')
    ).rejects.toMatchObject({ message: 'profile not found' });

    expect(useAuthStore.getState().isLoading).toBe(false);
  });
});

// ─── signOut ─────────────────────────────────────────────────────────────────

describe('AuthStore — signOut', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupFromChain();
  });

  test('clears user, profile, and shop from state', async () => {
    useAuthStore.setState({
      user: { id: 'user-1', email: 'test@example.com' },
      profile: makeProfile(),
      shop: makeShop(),
      isLoading: false,
      isInitialized: true,
    });

    mockSignOut.mockResolvedValueOnce({});

    await useAuthStore.getState().signOut();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.profile).toBeNull();
    expect(state.shop).toBeNull();
  });

  test('calls supabase.auth.signOut exactly once', async () => {
    mockSignOut.mockResolvedValueOnce({});
    await useAuthStore.getState().signOut();
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});

// ─── registerPushToken ────────────────────────────────────────────────────────

describe('AuthStore — registerPushToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupFromChain();
    resetStore();
  });

  test('granted permission: fetches token, updates DB and profile in state', async () => {
    useAuthStore.setState({
      user: { id: 'user-1', email: 'test@example.com' },
      profile: makeProfile({ push_token: null }),
      shop: null,
      isLoading: false,
      isInitialized: true,
    });

    mockGetPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });
    mockGetExpoPushTokenAsync.mockResolvedValueOnce({ data: 'ExponentPushToken[abc]' });

    await useAuthStore.getState().registerPushToken('user-1');

    expect(mockUpdate).toHaveBeenCalledWith({ push_token: 'ExponentPushToken[abc]' });
    expect(useAuthStore.getState().profile?.push_token).toBe('ExponentPushToken[abc]');
  });

  test('not-yet-granted: requests permission, then proceeds when granted', async () => {
    useAuthStore.setState({
      user: { id: 'user-1', email: 'x' },
      profile: makeProfile(),
      shop: null,
      isLoading: false,
      isInitialized: true,
    });

    mockGetPermissionsAsync.mockResolvedValueOnce({ status: 'undetermined' });
    mockRequestPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });
    mockGetExpoPushTokenAsync.mockResolvedValueOnce({ data: 'ExponentPushToken[req]' });

    await useAuthStore.getState().registerPushToken('user-1');

    expect(mockRequestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().profile?.push_token).toBe('ExponentPushToken[req]');
  });

  test('permission denied: returns early without fetching token or updating DB', async () => {
    useAuthStore.setState({
      user: { id: 'user-1', email: 'x' },
      profile: makeProfile({ push_token: null }),
      shop: null,
      isLoading: false,
      isInitialized: true,
    });

    mockGetPermissionsAsync.mockResolvedValueOnce({ status: 'undetermined' });
    mockRequestPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });

    await useAuthStore.getState().registerPushToken('user-1');

    expect(mockGetExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(useAuthStore.getState().profile?.push_token).toBeNull();
  });

  test('exception is swallowed silently (best-effort, non-critical)', async () => {
    useAuthStore.setState({
      user: { id: 'user-1', email: 'x' },
      profile: makeProfile(),
      shop: null,
      isLoading: false,
      isInitialized: true,
    });

    mockGetPermissionsAsync.mockRejectedValueOnce(new Error('Notifications unavailable'));

    await expect(useAuthStore.getState().registerPushToken('user-1')).resolves.toBeUndefined();
  });

  test('skips entirely when Platform.OS === "web"', async () => {
    const { Platform } = require('react-native');
    const originalOS = Platform.OS;
    Platform.OS = 'web';

    useAuthStore.setState({
      user: { id: 'user-1', email: 'x' },
      profile: makeProfile(),
      shop: null,
      isLoading: false,
      isInitialized: true,
    });

    await useAuthStore.getState().registerPushToken('user-1');

    expect(mockGetPermissionsAsync).not.toHaveBeenCalled();

    Platform.OS = originalOS;
  });
});
