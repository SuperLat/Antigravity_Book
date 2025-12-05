import { Book, PromptTemplate, IdeaProject, AppSettings } from '../types';

const API_BASE = '/api';

// Helper to get token
const getToken = () => localStorage.getItem('token');

// Generic fetch helper
async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const token = getToken();
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options?.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
    });

    if (!response.ok) {
        if (response.status === 401) {
            // Token expired or invalid
            localStorage.removeItem('token');
            window.location.reload(); // Force reload to show login
            throw new Error('Unauthorized');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `API Error: ${response.statusText}`);
    }

    return response.json();
}

// Auth API
export const authAPI = {
    login: (data: any) => fetchAPI<any>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    register: (data: any) => fetchAPI<any>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    getCurrentUser: () => fetchAPI<any>('/auth/me'),
    updateUser: (data: any) => fetchAPI<any>('/auth/me', {
        method: 'PUT',
        body: JSON.stringify(data),
    }),
};

// Books API
export const booksAPI = {
    getAll: () => fetchAPI<Book[]>('/books'),
    save: (book: Book) => fetchAPI<Book>('/books', {
        method: 'POST',
        body: JSON.stringify(book),
    }),
    delete: (id: string) => fetchAPI<void>(`/books/${id}`, {
        method: 'DELETE',
    }),
};

// Prompts API
export const promptsAPI = {
    getAll: () => fetchAPI<PromptTemplate[]>('/prompts'),
    save: (prompt: PromptTemplate) => fetchAPI<PromptTemplate>('/prompts', {
        method: 'POST',
        body: JSON.stringify(prompt),
    }),
    delete: (id: string) => fetchAPI<void>(`/prompts/${id}`, {
        method: 'DELETE',
    }),
};

// Ideas API
export const ideasAPI = {
    getAll: () => fetchAPI<IdeaProject[]>('/ideas'),
    save: (idea: IdeaProject) => fetchAPI<IdeaProject>('/ideas', {
        method: 'POST',
        body: JSON.stringify(idea),
    }),
    delete: (id: string) => fetchAPI<void>(`/ideas/${id}`, {
        method: 'DELETE',
    }),
};

// Settings API
export const settingsAPI = {
    get: () => fetchAPI<AppSettings>('/settings'),
    save: (settings: AppSettings) => fetchAPI<AppSettings>('/settings', {
        method: 'POST',
        body: JSON.stringify(settings),
    }),
};
