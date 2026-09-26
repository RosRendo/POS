import type { WebSocketMessage } from "@/types";

type EventCallback = (data: any) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private listeners = new Map<string, EventCallback[]>();
  private isConnecting = false;
  private userId: number | null = null;

  connect(userId: number): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    this.userId = userId;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001";

    try {
      this.ws = new WebSocket(`${wsUrl}/ws`);

      this.ws.onopen = () => {
        console.log("WebSocket connected");
        this.isConnecting = false;
        this.reconnectAttempts = 0;

        // Authenticate
        if (this.userId) {
          this.send({ type: "auth", userId: this.userId } as WebSocketMessage);
        }

        // Notify listeners
        this.emit("connected");
      };

      this.ws.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error("WebSocket message error:", error);
        }
      };

      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        this.emit("error", error);
      };

      this.ws.onclose = () => {
        console.log("WebSocket disconnected");
        this.isConnecting = false;
        this.emit("disconnected");
        this.attemptReconnect();
      };
    } catch (error) {
      console.error("WebSocket connection error:", error);
      this.isConnecting = false;
      this.attemptReconnect();
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnection
      this.ws.close();
      this.ws = null;
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log("Max reconnect attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(
      `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`,
    );

    setTimeout(() => {
      if (this.userId) {
        this.connect(this.userId);
      }
    }, delay);
  }

  send(data: WebSocketMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn("WebSocket not connected");
    }
  }

  subscribe(channel: string): void {
    this.send({ type: "subscribe", channel });
  }

  unsubscribe(channel: string): void {
    this.send({ type: "unsubscribe", channel });
  }

  on(event: string, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  off(event: string, callback?: EventCallback): void {
    if (!this.listeners.has(event)) return;

    if (callback) {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    } else {
      this.listeners.delete(event);
    }
  }

  private emit(event: string, data?: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => callback(data));
    }
  }

  private handleMessage(data: WebSocketMessage): void {
    const { type, ...payload } = data;

    switch (type) {
      case "connected":
        this.emit("connected", payload);
        break;

      case "auth_success":
        this.emit("authenticated", payload);
        break;

      case "subscribed":
        this.emit("subscribed", payload);
        break;

      case "sale:created":
        this.emit("sale:created", payload.data);
        break;

      case "inventory:updated":
        this.emit("inventory:updated", payload.data);
        break;

      case "dashboard:update":
        this.emit("dashboard:update", payload.data);
        break;

      case "pong":
        this.emit("pong", payload);
        break;

      case "error":
        this.emit("error", payload);
        break;

      default:
        console.log("Unknown message type:", type);
    }
  }

  ping(): void {
    this.send({ type: "ping" });
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Export singleton instance
let wsClient: WebSocketClient | null = null;

export function getWebSocketClient(): WebSocketClient | null {
  if (typeof window === "undefined") return null;

  if (!wsClient) {
    wsClient = new WebSocketClient();
  }

  return wsClient;
}

export default getWebSocketClient;
