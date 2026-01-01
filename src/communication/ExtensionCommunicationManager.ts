/**
 * Extension側通信マネージャー
 * Webviewとの確実な通信を管理
 */

import * as vscode from 'vscode';
import {
  ProtocolMessage,
  RequestMessage,
  ResponseMessage,
  NotificationMessage,
  AckMessage,
  MessageType,
  ExtensionCommand,
  WebviewCommand,
  generateMessageId,
  CommunicationConfig,
  DEFAULT_CONFIG,
  ErrorCode,
  SyncStateData
} from './protocol';

interface PendingRequest {
  resolve: (response: ResponseMessage) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
  retries: number;
  message: RequestMessage;
}

export class ExtensionCommunicationManager {
  private panel: vscode.WebviewPanel;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private config: CommunicationConfig;
  private messageHandlers: Map<string, (data: any) => Promise<any>> = new Map();
  private isConnected: boolean = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private syncInterval: NodeJS.Timeout | null = null;
  private lastMessageTime: number = Date.now();

  constructor(panel: vscode.WebviewPanel, config: Partial<CommunicationConfig> = {}) {
    this.panel = panel;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.setupMessageListener();
    this.startHeartbeat();
    this.startSync();
  }

  /**
   * メッセージリスナーのセットアップ
   */
  private setupMessageListener(): void {
    this.panel.webview.onDidReceiveMessage((message: ProtocolMessage) => {
      this.lastMessageTime = Date.now();
      this.handleIncomingMessage(message);
    });
  }

  /**
   * 受信メッセージの処理
   */
  private async handleIncomingMessage(message: any): Promise<void> {
    // メッセージの基本構造を検証
    if (!message || typeof message !== 'object') {
      console.warn('[ExtComm] Invalid message format (not an object):', message);
      return;
    }

    // 新しいプロトコル形式かチェック
    if (!message.type || !message.id || !message.command || !message.timestamp) {
      console.warn('[ExtComm] Invalid protocol message (missing required fields):', message);
      return;
    }

    const protocolMessage = message as ProtocolMessage;
    console.log('[ExtComm] Received message:', protocolMessage.type, protocolMessage.command, protocolMessage.id);

    try {
      switch (protocolMessage.type) {
        case MessageType.REQUEST:
          await this.handleRequest(protocolMessage as RequestMessage);
          break;

        case MessageType.RESPONSE:
          this.handleResponse(protocolMessage as ResponseMessage);
          break;

        case MessageType.ACK:
          this.handleAck(protocolMessage as AckMessage);
          break;

        case MessageType.NOTIFICATION:
          await this.handleNotification(protocolMessage as NotificationMessage);
          break;

        case MessageType.ERROR:
          console.error('[ExtComm] Received error message:', protocolMessage);
          break;

        default:
          console.warn('[ExtComm] Unknown message type:', (protocolMessage as any).type);
      }
    } catch (error) {
      console.error('[ExtComm] Error handling message:', error);
      if (protocolMessage.id) {
        this.sendError(protocolMessage.id, error instanceof Error ? error.message : String(error));
      }
    }
  }

  /**
   * リクエストメッセージの処理
   */
  private async handleRequest(message: RequestMessage): Promise<void> {
    // まずACKを送信
    this.sendAck(message.id);

    const handler = this.messageHandlers.get(message.command);
    if (!handler) {
      console.warn('[ExtComm] No handler for command:', message.command);
      this.sendResponse(message.id, false, undefined, `No handler for command: ${message.command}`);
      return;
    }

    try {
      const result = await handler(message.data);
      this.sendResponse(message.id, true, result);
    } catch (error) {
      console.error('[ExtComm] Handler error:', error);
      this.sendResponse(message.id, false, undefined, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * レスポンスメッセージの処理
   */
  private handleResponse(message: ResponseMessage): void {
    const pending = this.pendingRequests.get(message.requestId);
    if (!pending) {
      console.warn('[ExtComm] Received response for unknown request:', message.requestId);
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(message.requestId);

    if (message.success) {
      pending.resolve(message);
    } else {
      pending.reject(new Error(message.error || 'Request failed'));
    }
  }

  /**
   * ACKメッセージの処理
   */
  private handleAck(message: AckMessage): void {
    console.log('[ExtComm] Received ACK for request:', message.requestId);
    // ACKを受信したことを記録（将来的な拡張用）
  }

  /**
   * 通知メッセージの処理
   */
  private async handleNotification(message: NotificationMessage): Promise<void> {
    const handler = this.messageHandlers.get(message.command);
    if (handler) {
      try {
        await handler(message.data);
      } catch (error) {
        console.error('[ExtComm] Notification handler error:', error);
      }
    }
  }

  /**
   * リクエストメッセージの送信（レスポンス待ち）
   */
  public async sendRequest<T = any>(
    command: ExtensionCommand,
    data?: any,
    timeout?: number
  ): Promise<T> {
    const message: RequestMessage = {
      id: generateMessageId(),
      type: MessageType.REQUEST,
      command,
      data,
      timestamp: Date.now(),
      expectResponse: true,
      timeout: timeout || this.config.defaultTimeout
    };

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(message.id);
        reject(new Error(`Request timeout: ${command}`));
      }, timeout || this.config.defaultTimeout);

      this.pendingRequests.set(message.id, {
        resolve: (response) => resolve(response.data),
        reject,
        timeout: timeoutHandle,
        retries: 0,
        message
      });

      this.postMessage(message);
    });
  }

  /**
   * 通知メッセージの送信（レスポンス不要）
   */
  public sendNotification(command: ExtensionCommand, data?: any): void {
    const message: NotificationMessage = {
      id: generateMessageId(),
      type: MessageType.NOTIFICATION,
      command,
      data,
      timestamp: Date.now()
    };

    this.postMessage(message);
  }

  /**
   * レスポンスメッセージの送信
   */
  private sendResponse(requestId: string, success: boolean, data?: any, error?: string): void {
    const message: ResponseMessage = {
      id: generateMessageId(),
      type: MessageType.RESPONSE,
      command: 'response',
      requestId,
      success,
      data,
      error,
      timestamp: Date.now()
    };

    this.postMessage(message);
  }

  /**
   * ACKメッセージの送信
   */
  private sendAck(requestId: string): void {
    const message: AckMessage = {
      id: generateMessageId(),
      type: MessageType.ACK,
      command: 'ack',
      requestId,
      timestamp: Date.now()
    };

    this.postMessage(message);
  }

  /**
   * エラーメッセージの送信
   */
  private sendError(requestId: string, error: string, code?: ErrorCode): void {
    const message: ProtocolMessage = {
      id: generateMessageId(),
      type: MessageType.ERROR,
      command: 'error',
      requestId,
      error,
      code,
      timestamp: Date.now()
    };

    this.postMessage(message);
  }

  /**
   * メッセージの実際の送信
   */
  private postMessage(message: ProtocolMessage): void {
    try {
      this.panel.webview.postMessage(message);
      console.log('[ExtComm] Sent message:', message.type, message.command, message.id);
    } catch (error) {
      console.error('[ExtComm] Failed to post message:', error);
      throw error;
    }
  }

  /**
   * メッセージハンドラーの登録
   */
  public registerHandler(command: string, handler: (data: any) => Promise<any>): void {
    this.messageHandlers.set(command, handler);
    console.log('[ExtComm] Registered handler for command:', command);
  }

  /**
   * メッセージハンドラーの登録解除
   */
  public unregisterHandler(command: string): void {
    this.messageHandlers.delete(command);
  }

  /**
   * ハートビートの開始
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.sendNotification(ExtensionCommand.PING, { timestamp: Date.now() });

      // 最後のメッセージから一定時間経過していたら警告
      const timeSinceLastMessage = Date.now() - this.lastMessageTime;
      if (timeSinceLastMessage > this.config.heartbeatInterval * 2) {
        console.warn('[ExtComm] No messages received for', timeSinceLastMessage, 'ms');
        this.isConnected = false;
      } else {
        this.isConnected = true;
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * 状態同期の開始
   */
  private startSync(): void {
    this.syncInterval = setInterval(() => {
      // 定期的に状態同期をリクエスト（実装は呼び出し側で）
      console.log('[ExtComm] Sync interval triggered');
    }, this.config.syncInterval);
  }

  /**
   * 接続状態の確認
   */
  public isWebviewConnected(): boolean {
    return this.isConnected;
  }

  /**
   * クリーンアップ
   */
  public dispose(): void {
    console.log('[ExtComm] Disposing communication manager');

    // 保留中のリクエストをすべてキャンセル
    for (const [id, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Communication manager disposed'));
    }
    this.pendingRequests.clear();

    // インターバルをクリア
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    // ハンドラーをクリア
    this.messageHandlers.clear();
  }

  /**
   * 状態同期メッセージの送信
   */
  public syncState(data: SyncStateData): void {
    this.sendNotification(ExtensionCommand.SYNC_STATE, data);
  }

  /**
   * テーブルデータ更新の送信
   */
  public updateTableData(data: any): void {
    this.sendNotification(ExtensionCommand.UPDATE_TABLE_DATA, data);
  }

  /**
   * Git差分更新の送信
   */
  public updateGitDiff(data: any): void {
    this.sendNotification(ExtensionCommand.UPDATE_GIT_DIFF, data);
  }

  /**
   * アクティブテーブル設定の送信
   */
  public setActiveTable(index: number): void {
    this.sendNotification(ExtensionCommand.SET_ACTIVE_TABLE, { index });
  }

  /**
   * テーマ変数適用の送信
   */
  public applyThemeVariables(cssText: string): void {
    this.sendNotification(ExtensionCommand.APPLY_THEME_VARIABLES, { cssText });
  }

  /**
   * フォント設定適用の送信
   */
  public applyFontSettings(fontFamily?: string, fontSize?: number): void {
    this.sendNotification(ExtensionCommand.APPLY_FONT_SETTINGS, { fontFamily, fontSize });
  }

  /**
   * 操作成功通知の送信
   */
  public sendOperationSuccess(message: string, data?: any): void {
    this.sendNotification(ExtensionCommand.OPERATION_SUCCESS, { message, data });
  }

  /**
   * 操作エラー通知の送信
   */
  public sendOperationError(error: string, code?: string): void {
    this.sendNotification(ExtensionCommand.OPERATION_ERROR, { error, code });
  }

  /**
   * セル更新エラー通知の送信
   */
  public sendCellUpdateError(row: number, col: number, error: string): void {
    this.sendNotification(ExtensionCommand.CELL_UPDATE_ERROR, { row, col, error });
  }

  /**
   * ヘッダー更新エラー通知の送信
   */
  public sendHeaderUpdateError(col: number, error: string): void {
    this.sendNotification(ExtensionCommand.HEADER_UPDATE_ERROR, { col, error });
  }
}
