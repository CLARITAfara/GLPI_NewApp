export interface IUserSession {
  sessionToken: string;
  userId?: number;
  userName?: string;
}

export class UserSession implements IUserSession {
  sessionToken: string;
  userId?: number;
  userName?: string;

  private static readonly STORAGE_KEY = 'glpi_session';

  constructor(data: IUserSession) {
    this.sessionToken = data.sessionToken;
    this.userId = data.userId;
    this.userName = data.userName;
  }

  static save(session: IUserSession): void {
    localStorage.setItem(UserSession.STORAGE_KEY, JSON.stringify(session));
  }

  static load(): UserSession | null {
    const raw = localStorage.getItem(UserSession.STORAGE_KEY);
    if (!raw) return null;
    try {
      const data = JSON.parse(raw) as IUserSession;
      return new UserSession(data);
    } catch {
      return null;
    }
  }

  static clear(): void {
    localStorage.removeItem(UserSession.STORAGE_KEY);
  }

  static isAuthenticated(): boolean {
    return UserSession.load() !== null;
  }
}
