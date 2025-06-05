import { apiClient, ApiResponse } from './apiClient.js';
import { API_CONFIG, APP_CONFIG, buildUrl } from './config.js';

export interface User {
  id: string;
  username: string;
  email?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

class AuthService {
  // Start GitHub OAuth flow
  public startGitHubAuth(): void {
    const authUrl = buildUrl(API_CONFIG.ENDPOINTS.AUTH_GITHUB);
    window.location.href = authUrl;
  }

  // Handle OAuth callback (called when returning from GitHub)
  public async handleOAuthCallback(code: string, state?: string): Promise<User> {
    try {
      // The backend will handle the OAuth exchange automatically
      // when we're redirected back from GitHub
      const user = await this.getCurrentUser();
      return user;
    } catch (error) {
      console.error('OAuth callback error:', error);
      throw new Error('Authentication failed');
    }
  }

  // Get current authenticated user
  public async getCurrentUser(): Promise<User> {
    try {
      const response: ApiResponse<{ user: User }> = await apiClient.get(
        API_CONFIG.ENDPOINTS.AUTH_ME
      );
      
      const user = response.data.user;
      this.setUser(user);
      return user;
    } catch (error) {
      this.clearAuth();
      throw error;
    }
  }

  // Logout user
  public async logout(): Promise<void> {
    try {
      await apiClient.post(API_CONFIG.ENDPOINTS.AUTH_LOGOUT);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearAuth();
    }
  }

  // Token management (delegates to apiClient)
  public isAuthenticated(): boolean {
    return apiClient.isAuthenticated();
  }

  public getToken(): string | null {
    return apiClient.getToken();
  }

  public setToken(token: string): void {
    apiClient.setToken(token);
  }

  // User data management
  public getUser(): User | null {
    const userData = localStorage.getItem(APP_CONFIG.USER_KEY);
    if (userData) {
      try {
        return JSON.parse(userData);
      } catch {
        localStorage.removeItem(APP_CONFIG.USER_KEY);
      }
    }
    return null;
  }

  public setUser(user: User): void {
    localStorage.setItem(APP_CONFIG.USER_KEY, JSON.stringify(user));
  }

  public clearAuth(): void {
    apiClient.clearAuth();
    localStorage.removeItem(APP_CONFIG.USER_KEY);
  }

  // Check if user data is available locally
  public hasUserData(): boolean {
    return !!this.getUser();
  }

  // Initialize auth state on app load
  public async initializeAuth(): Promise<User | null> {
    if (!this.isAuthenticated()) {
      return null;
    }

    try {
      // Verify token is still valid and get fresh user data
      const user = await this.getCurrentUser();
      return user;
    } catch (error) {
      console.error('Auth initialization failed:', error);
      this.clearAuth();
      return null;
    }
  }

  // Migration helper: Check if user has localStorage data to migrate
  public hasLocalStorageData(): boolean {
    const projects = localStorage.getItem('cognicraft_projects');
    const currentProject = localStorage.getItem('cognicraft_currentProject');
    return !!(projects || currentProject);
  }

  // Mark data as migrated
  public setMigrationComplete(): void {
    localStorage.setItem(APP_CONFIG.MIGRATION_KEY, 'true');
  }

  public isMigrationComplete(): boolean {
    return localStorage.getItem(APP_CONFIG.MIGRATION_KEY) === 'true';
  }
}

// Export singleton instance
export const authService = new AuthService(); 