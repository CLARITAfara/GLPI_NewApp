import { GlpiApiClient } from '../api/GlpiApiClient';
import { UserSession } from '../models/UserSession';

export class AuthService {
  private readonly apiClient: GlpiApiClient;

  constructor() {
    this.apiClient = new GlpiApiClient();
  }

  private encodeCredentials(username: string, password: string): string {
    return btoa(`${username}:${password}`);
  }

  async login(username: string, password: string): Promise<UserSession> {
    const credentials = this.encodeCredentials(username, password);
    const { session_token } = await this.apiClient.initSession(credentials);

    let userName: string | undefined;
    let userId: number | undefined;

    try {
      const fullSession = await this.apiClient.getFullSession(session_token);
      const s = fullSession.session;
      userId = s.glpiID;
      const first = s.glpifirstname ?? '';
      const last = s.glpirealname ?? '';
      userName = `${first} ${last}`.trim() || s.glpiname;
    } catch {
      userName = username;
    }

    const session = new UserSession({ sessionToken: session_token, userId, userName });
    UserSession.save(session);
    return session;
  }

  async logout(): Promise<void> {
    const session = UserSession.load();
    if (session) {
      try {
        await this.apiClient.killSession(session.sessionToken);
      } catch {
        // Session may already be expired — proceed to clear anyway
      }
      UserSession.clear();
    }
  }

  isAuthenticated(): boolean {
    return UserSession.isAuthenticated();
  }

  getCurrentSession(): UserSession | null {
    return UserSession.load();
  }
}
