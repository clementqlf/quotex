import { authService } from '../AuthService';
import { supabase } from '@/src/shared/api/supabase';
import { StorageService, STORAGE_KEYS } from '@/src/shared/api/StorageService';
import { httpClient } from '@/src/shared/api/HttpClient';

jest.mock('@/src/shared/api/HttpClient', () => ({
  httpClient: {
    delete: jest.fn(),
    patch: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
  },
}));

jest.mock('@/src/shared/api/StorageService', () => ({
  StorageService: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
  STORAGE_KEYS: {
    USER_DATA: 'USER_DATA',
  },
}));

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkEmailExists', () => {
    it('returns true when edge function indicates email exists', async () => {
      const invokeMock = jest.fn().mockResolvedValue({ data: { exists: true }, error: null });
      (supabase.functions.invoke as jest.Mock) = invokeMock;

      const exists = await authService.checkEmailExists('Test@Example.com');
      expect(exists).toBe(true);
      expect(invokeMock).toHaveBeenCalledWith('check-email', {
        body: { email: 'test@example.com' },
      });
    });

    it('returns false when edge function returns false', async () => {
      const invokeMock = jest.fn().mockResolvedValue({ data: { exists: false }, error: null });
      (supabase.functions.invoke as jest.Mock) = invokeMock;

      const exists = await authService.checkEmailExists('new@example.com');
      expect(exists).toBe(false);
    });

    it('returns false and logs error on failure', async () => {
      const invokeMock = jest.fn().mockRejectedValue(new Error('Network failure'));
      (supabase.functions.invoke as jest.Mock) = invokeMock;

      const exists = await authService.checkEmailExists('error@example.com');
      expect(exists).toBe(false);
    });
  });

  describe('checkUsernameExists', () => {
    it('returns true when username exists', async () => {
      const invokeMock = jest.fn().mockResolvedValue({ data: { exists: true }, error: null });
      (supabase.functions.invoke as jest.Mock) = invokeMock;

      const exists = await authService.checkUsernameExists('alex');
      expect(exists).toBe(true);
      expect(invokeMock).toHaveBeenCalledWith('check-username', {
        body: { username: 'alex' },
      });
    });

    it('returns false on error', async () => {
      const invokeMock = jest.fn().mockResolvedValue({ data: null, error: new Error('Error') });
      (supabase.functions.invoke as jest.Mock) = invokeMock;

      const exists = await authService.checkUsernameExists('alex');
      expect(exists).toBe(false);
    });
  });

  describe('login', () => {
    it('authenticates user and caches profile data', async () => {
      const mockUser = { id: 'usr-1', email: 'test@example.com' };
      const mockSession = { access_token: 'token-123' };
      const mockProfile = { id: 'usr-1', username: 'testuser', name: 'Test User' };

      (supabase.auth.signInWithPassword as jest.Mock) = jest.fn().mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const singleMock = jest.fn().mockResolvedValue({ data: mockProfile, error: null });
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: singleMock,
      });

      const result = await authService.login('test@example.com', 'secret123');

      expect(result).toEqual({
        user: mockProfile,
        token: 'token-123',
      });
      expect(StorageService.setItem).toHaveBeenCalledWith(STORAGE_KEYS.USER_DATA, mockProfile);
    });

    it('throws error when login fails', async () => {
      (supabase.auth.signInWithPassword as jest.Mock) = jest.fn().mockResolvedValue({
        data: { user: null, session: null },
        error: new Error('Invalid credentials'),
      });

      await expect(authService.login('test@example.com', 'wrong')).rejects.toThrow('Invalid credentials');
    });
  });

  describe('register', () => {
    it('registers user, strips @ from username, and saves auth data', async () => {
      const mockUser = { id: 'usr-2' };
      const mockSession = { access_token: 'token-456' };
      const mockProfile = { id: 'usr-2', username: 'newuser', name: 'New User' };

      (supabase.auth.signUp as jest.Mock) = jest.fn().mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockProfile, error: null }),
      });

      const result = await authService.register('@newuser', 'new@example.com', 'pass123', 'New User');

      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'pass123',
        options: {
          data: {
            username: 'newuser',
            name: 'New User',
          },
        },
      });

      expect(result.user).toEqual(mockProfile);
      expect(result.token).toBe('token-456');
    });
  });

  describe('logout & resetPassword', () => {
    it('logs out and removes cached user data', async () => {
      (supabase.auth.signOut as jest.Mock) = jest.fn().mockResolvedValue({ error: null });

      await authService.logout();

      expect(supabase.auth.signOut).toHaveBeenCalled();
      expect(StorageService.removeItem).toHaveBeenCalledWith(STORAGE_KEYS.USER_DATA);
    });

    it('sends reset password email', async () => {
      (supabase.auth.resetPasswordForEmail as jest.Mock) = jest.fn().mockResolvedValue({ error: null });

      await authService.resetPassword('user@example.com');

      expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('user@example.com');
    });
  });

  describe('deleteAccount & updateUser', () => {
    it('deletes account via httpClient and logs out', async () => {
      (supabase.auth.getSession as jest.Mock) = jest.fn().mockResolvedValue({
        data: { session: { access_token: 'tok' } },
      });
      (httpClient.delete as jest.Mock).mockResolvedValue({});
      (supabase.auth.signOut as jest.Mock) = jest.fn().mockResolvedValue({ error: null });

      await authService.deleteAccount();

      expect(httpClient.delete).toHaveBeenCalledWith('/users/me');
      expect(StorageService.removeItem).toHaveBeenCalledWith(STORAGE_KEYS.USER_DATA);
    });

    it('throws error when deleteAccount is called without active session', async () => {
      (supabase.auth.getSession as jest.Mock) = jest.fn().mockResolvedValue({
        data: { session: null },
      });

      await expect(authService.deleteAccount()).rejects.toThrow('Not authenticated');
    });

    it('updates user profile via httpClient and updates cache', async () => {
      const updatedProfile = { id: 'usr-1', username: 'updated', name: 'Updated' };
      (supabase.auth.getSession as jest.Mock) = jest.fn().mockResolvedValue({
        data: { session: { access_token: 'tok' } },
      });
      (httpClient.patch as jest.Mock).mockResolvedValue(updatedProfile);

      const result = await authService.updateUser({ username: '@updated', name: 'Updated' });

      expect(httpClient.patch).toHaveBeenCalledWith('/users/me', {
        username: 'updated',
        name: 'Updated',
      });
      expect(StorageService.setItem).toHaveBeenCalledWith(STORAGE_KEYS.USER_DATA, updatedProfile);
      expect(result).toEqual(updatedProfile);
    });
  });

  describe('followUser & unfollowUser', () => {
    it('inserts follow row into UserFollow table', async () => {
      (supabase.auth.getSession as jest.Mock) = jest.fn().mockResolvedValue({
        data: { session: { user: { id: 'follower-1' } } },
      });

      const insertMock = jest.fn().mockResolvedValue({ error: null });
      (supabase.from as jest.Mock).mockReturnValue({ insert: insertMock });

      await authService.followUser('target-user-2');

      expect(supabase.from).toHaveBeenCalledWith('UserFollow');
      expect(insertMock).toHaveBeenCalledWith({
        followerId: 'follower-1',
        followingId: 'target-user-2',
      });
    });

    it('deletes follow row from UserFollow table', async () => {
      (supabase.auth.getSession as jest.Mock) = jest.fn().mockResolvedValue({
        data: { session: { user: { id: 'follower-1' } } },
      });

      const eqSecondMock = jest.fn().mockResolvedValue({ error: null });
      const eqFirstMock = jest.fn().mockReturnValue({ eq: eqSecondMock });
      (supabase.from as jest.Mock).mockReturnValue({
        delete: jest.fn().mockReturnValue({ eq: eqFirstMock }),
      });

      await authService.unfollowUser('target-user-2');

      expect(supabase.from).toHaveBeenCalledWith('UserFollow');
      expect(eqFirstMock).toHaveBeenCalledWith('followerId', 'follower-1');
      expect(eqSecondMock).toHaveBeenCalledWith('followingId', 'target-user-2');
    });
  });

  describe('getFollowers & getFollowing', () => {
    it('fetches followers list', async () => {
      const mockFollowerProfile = { id: 'f-1', username: 'follower1' };
      const mockData = [{ follower: mockFollowerProfile }];

      const eqMock = jest.fn().mockResolvedValue({ data: mockData, error: null });
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({ eq: eqMock }),
      });

      const followers = await authService.getFollowers('user-1');

      expect(followers).toEqual([mockFollowerProfile]);
    });

    it('fetches following list', async () => {
      const mockFollowingProfile = { id: 'f-2', username: 'following1' };
      const mockData = [{ following: mockFollowingProfile }];

      const eqMock = jest.fn().mockResolvedValue({ data: mockData, error: null });
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({ eq: eqMock }),
      });

      const following = await authService.getFollowing('user-1');

      expect(following).toEqual([mockFollowingProfile]);
    });
  });

  describe('getUser', () => {
    it('returns cached profile if valid for current session user', async () => {
      const cachedProfile = { id: 'usr-1', username: 'cachedUser' };
      (supabase.auth.getSession as jest.Mock) = jest.fn().mockResolvedValue({
        data: { session: { user: { id: 'usr-1' } } },
      });
      (StorageService.getItem as jest.Mock).mockResolvedValue(cachedProfile);

      const user = await authService.getUser();
      expect(user).toEqual(cachedProfile);
    });

    it('fetches fresh profile when cache is empty', async () => {
      const freshProfile = { id: 'usr-1', username: 'freshUser' };
      (supabase.auth.getSession as jest.Mock) = jest.fn().mockResolvedValue({
        data: { session: { user: { id: 'usr-1' } } },
      });
      (StorageService.getItem as jest.Mock).mockResolvedValue(null);

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: freshProfile, error: null }),
      });

      const user = await authService.getUser();
      expect(user).toEqual(freshProfile);
      expect(StorageService.setItem).toHaveBeenCalledWith(STORAGE_KEYS.USER_DATA, freshProfile);
    });

    it('returns null if no active session', async () => {
      (supabase.auth.getSession as jest.Mock) = jest.fn().mockResolvedValue({
        data: { session: null },
      });

      const user = await authService.getUser();
      expect(user).toBeNull();
    });
  });

  describe('onAuthStateChange', () => {
    it('subscribes to auth state change and triggers callback on session change', async () => {
      const unsubscribeMock = jest.fn();
      let listenerCallback: Function = () => {};

      (supabase.auth.onAuthStateChange as jest.Mock) = jest.fn().mockImplementation((cb) => {
        listenerCallback = cb;
        return { data: { subscription: { unsubscribe: unsubscribeMock } } };
      });

      const userCallback = jest.fn();
      const unsubscribe = authService.onAuthStateChange(userCallback);

      // Trigger listener with session = null
      await listenerCallback('SIGNED_OUT', null);

      expect(userCallback).toHaveBeenCalledWith(null, null);

      unsubscribe();
      expect(unsubscribeMock).toHaveBeenCalled();
    });
  });
});
