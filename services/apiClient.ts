import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { API_CONFIG, APP_CONFIG } from './config.js';

export interface ApiResponse<T = any> {
  data: T;
  status: number;
  message?: string;
}

export interface ApiError {
  message: string;
  status: number;
  details?: any;
}

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      timeout: APP_CONFIG.DEFAULT_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = this.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          this.clearAuth();
          window.location.href = '/'; // Redirect to home
        }
        return Promise.reject(this.formatError(error));
      }
    );
  }

  private formatError(error: any): ApiError {
    if (error.response) {
      return {
        message: error.response.data?.message || error.response.data?.error || 'Server error',
        status: error.response.status,
        details: error.response.data,
      };
    }
    
    if (error.request) {
      return {
        message: 'Network error - please check your connection',
        status: 0,
      };
    }
    
    return {
      message: error.message || 'An unexpected error occurred',
      status: -1,
    };
  }

  // Auth token management
  public setToken(token: string): void {
    localStorage.setItem(APP_CONFIG.TOKEN_KEY, token);
  }

  public getToken(): string | null {
    return localStorage.getItem(APP_CONFIG.TOKEN_KEY);
  }

  public clearAuth(): void {
    localStorage.removeItem(APP_CONFIG.TOKEN_KEY);
    localStorage.removeItem(APP_CONFIG.USER_KEY);
  }

  public isAuthenticated(): boolean {
    return !!this.getToken();
  }

  // HTTP methods
  public async get<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response: AxiosResponse<T> = await this.client.get(url, config);
    return {
      data: response.data,
      status: response.status,
    };
  }

  public async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response: AxiosResponse<T> = await this.client.post(url, data, config);
    return {
      data: response.data,
      status: response.status,
    };
  }

  public async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response: AxiosResponse<T> = await this.client.put(url, data, config);
    return {
      data: response.data,
      status: response.status,
    };
  }

  public async delete<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response: AxiosResponse<T> = await this.client.delete(url, config);
    return {
      data: response.data,
      status: response.status,
    };
  }

  // Health check
  public async health(): Promise<boolean> {
    try {
      await this.get('/health');
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const apiClient = new ApiClient(); 