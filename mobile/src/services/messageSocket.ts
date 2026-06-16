import { API_BASE_URL } from '../constants/api';
import { getAccessToken, subscribeToAccessTokenChanges } from './tokenStorage';

type MessageEventPayload = {
  type: string;
  kind?: string;
  message?: {
    id: number;
    metin: string;
    tarih: string;
    gonderen_id: number;
    alici_id: number;
    ilan_id?: number | null;
    okundu: boolean;
  };
  reader_id?: number;
  other_user_id?: number;
  ilan_id?: number | null;
  ilan_baslik?: string;
  comment_id?: number;
  yazan_kullanici_id?: number;
  read_message_ids?: number[];
};

type MessageEventListener = (payload: MessageEventPayload) => void;

function createWebSocketUrl(token: string) {
  const baseUrl = API_BASE_URL.replace(/\/$/, '');
  const wsBaseUrl = baseUrl.replace(/^http:\/\//i, 'ws://').replace(/^https:\/\//i, 'wss://');
  return `${wsBaseUrl}/ws/messages?token=${encodeURIComponent(token)}`;
}

class MessageSocketService {
  private socket: WebSocket | null = null;
  private listeners = new Set<MessageEventListener>();
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private isConnecting = false;
  private shouldReconnect = false;
  private isActive = false;
  private currentToken: string | null = null;
  private socketToken: string | null = null;

  constructor() {
    subscribeToAccessTokenChanges((token) => {
      this.currentToken = token;

      if (!this.isActive) {
        return;
      }

      if (!token) {
        this.disconnect();
        return;
      }

      void this.connect(token);
    });
  }

  subscribe(listener: MessageEventListener) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  activate() {
    if (this.isActive) {
      return;
    }

    this.isActive = true;
    this.shouldReconnect = true;
    void this.connect(this.currentToken);
  }

  async connect(nextToken?: string | null) {
    const token = nextToken ?? this.currentToken ?? (await getAccessToken());

    if (!this.isActive) {
      return;
    }

    if (!token) {
      this.disconnect();
      return;
    }

    this.currentToken = token;

    if (this.socket && this.socketToken === token) {
      const readyState = this.socket.readyState;
      if (readyState === WebSocket.OPEN || readyState === WebSocket.CONNECTING) {
        return;
      }
    }

    if (this.socket && this.socketToken !== token) {
      this.closeCurrentSocket();
    }

    if (this.isConnecting && this.socketToken === token) {
      return;
    }

    this.clearReconnectTimeout();
    this.shouldReconnect = true;
    this.isConnecting = true;

    try {
      const socket = new WebSocket(createWebSocketUrl(token));
      const connectionToken = token;
      this.socket = socket;
      this.socketToken = connectionToken;

      socket.onopen = () => {
        if (this.currentToken !== connectionToken) {
          socket.close();
          return;
        }

        this.isConnecting = false;
        this.reconnectAttempts = 0;
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as MessageEventPayload;
          for (const listener of this.listeners) {
            listener(payload);
          }
        } catch {
          // Ignore malformed socket payloads.
        }
      };

      socket.onerror = () => {
        // Let onclose handle reconnect.
      };

      socket.onclose = () => {
        if (this.socket === socket) {
          this.socket = null;
          this.socketToken = null;
        }

        this.isConnecting = false;

        if (!this.shouldReconnect || !this.isActive || this.currentToken !== connectionToken) {
          return;
        }

        this.scheduleReconnect();
      };
    } catch {
      this.socket = null;
      this.socketToken = null;
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  deactivate() {
    this.isActive = false;
    this.disconnect();
  }

  disconnect() {
    this.shouldReconnect = false;
    this.reconnectAttempts = 0;
    this.isConnecting = false;

    this.clearReconnectTimeout();
    this.closeCurrentSocket();
  }

  private clearReconnectTimeout() {
    if (!this.reconnectTimeout) {
      return;
    }

    clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = null;
  }

  private closeCurrentSocket() {
    if (!this.socket) {
      return;
    }

    const socket = this.socket;
    this.socket = null;
    this.socketToken = null;
    socket.close();
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout || !this.shouldReconnect || !this.isActive || !this.currentToken) {
      return;
    }

    const delayMs = Math.min(1000 * 2 ** this.reconnectAttempts, 10000);
    this.reconnectAttempts += 1;

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      void this.connect(this.currentToken);
    }, delayMs);
  }
}

export const messageSocket = new MessageSocketService();
