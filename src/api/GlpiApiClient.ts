import axios from 'axios';
import type { AxiosInstance, AxiosResponse } from 'axios';

export interface InitSessionResponse {
  session_token: string;
}

export interface GlpiUser {
  id: number;
  name: string;
  realname?: string;
  firstname?: string;
}

export class GlpiApiClient {
  private readonly client: AxiosInstance;
  private readonly appToken: string;

  constructor() {
    const baseURL = import.meta.env.VITE_GLPI_API_URL as string;
    this.appToken = import.meta.env.VITE_GLPI_APP_TOKEN as string;

    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
        'App-Token': this.appToken,
      },
    });
  }

  async initSession(credentials: string): Promise<InitSessionResponse> {
    const response: AxiosResponse<InitSessionResponse> = await this.client.get(
      '/initSession',
      {
        headers: {
          Authorization: `Basic ${credentials}`,
        },
      }
    );
    return response.data;
  }

  async killSession(sessionToken: string): Promise<void> {
    await this.client.get('/killSession', {
      headers: {
        'Session-Token': sessionToken,
      },
    });
  }

  async getCurrentUser(sessionToken: string): Promise<GlpiUser> {
    const response: AxiosResponse<GlpiUser> = await this.client.get(
      '/getMyProfiles',
      {
        headers: {
          'Session-Token': sessionToken,
        },
      }
    );
    return response.data;
  }

  async getFullSession(sessionToken: string): Promise<{ session: { glpiname?: string; glpifirstname?: string; glpirealname?: string; glpiID?: number } }> {
    const response = await this.client.get('/getFullSession', {
      headers: {
        'Session-Token': sessionToken,
      },
    });
    return response.data;
  }
}
