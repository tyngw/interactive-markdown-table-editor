/**
 * Webview側通信マネージャー
 * Extension側との確実な通信を管理
 */

import {
  ProtocolMessage,
  RequestMessage,
  ResponseMessage,
  NotificationMessage,
  AckMessage,
  MessageType,
  WebviewCommand,
  ExtensionCommand,
  generateMessageId,
  CommunicationConfig,
  DEFAULT_CONFIG,
  ErrorCode
} from '../../../src/communication/protocol';

interface PendingRequest {
  resolve: (response: ResponseMessage) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
  retries: number;
  message: RequestMessage;
}

interface VSCodeAPI {
  postMessage: (message: any) => void;
  getState: () => any;
  setState: (state: any) => void;
}

export class WebviewCommunicationManager {
  private vscodeApi: VSCodeAPI | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private config: CommunicationConfig;
  private messageHandlers: Map<string, (data: any) => Promise<any>> = new Map();
  private notificationHandlers: Map<string, (data: any) => void> = new Map();
  private isConnected: boolean = false;
  private lastMessageTime: number = Date.now();
  private messageListener: ((event: MessageEvent) => void) | null = null;

  constructor(vscodeApi: VSCodeAPI, config: Partial<CommunicationConfig> = {}) {
    this.vscodeApi = vscodeApi;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.setupMessageListener();
  }

  /**
   * メッセージリスナーのセットアップ
   */
  private setupMessageListener(): void {
    this.messageListener = (event: MessageEvent) => {
      const message = event.data;
      this.handleIncomingMessage(message);
    };

    window.addEventListener('message', this.messageListener);
  }

  /**
   * 受信メッセージの処理
   */
  private async handleIncomingMessage(message: any): Promise<void> {
    // メッセージの基本構造を検証
    if (!message || typeof message !== 'object') {
      console.warn('[WebComm] Invalid message format (not an object):', message);
      return;
    }

    // 新しいプロトコル形式かチェック
    if (!message.type || !message.id || !message.command || !message.timestamp) {
      console.warn('[WebComm] Invalid protocol message (missing required fields):', message);
      return;
    }

    // 有効なメッセージの場合のみ更新
    this.lastMessageTime = Date.now();

    const protocolMessage = message as ProtocolMessage;
    console.log('[WebComm] Received message:', protocolMessage.type, protocolMessage.command, protocolMessage.id);

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
          console.error('[WebComm] Received error message:', protocolMessage);
          break;

        default:
          console.warn('[WebComm] Unknown message type:', (protocolMessage as any).type);
      }
    } catch (error) {
      console.error('[WebComm] Error handling message:', error);
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
      console.warn('[WebComm] No handler for command:', message.command);
      this.sendResponse(message.id, false, undefined, `No handler for command: ${message.command}`);
      return;
    }

    try {
      const result = await handler(message.data);
      this.sendResponse(message.id, true, result);
    } catch (error) {
      console.error('[WebComm] Handler error:', error);
      this.sendResponse(message.id, false, undefined, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * レスポンスメッセージの処理
   */
  private handleResponse(message: ResponseMessage): void {
    const pending = this.pendingRequests.get(message.requestId);
    if (!pending) {
      console.warn('[WebComm] Received response for unknown request:', message.requestId);
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(message.requestId);

    if (message.success) {
      pending.resolve(message);
      this.isConnected = true;
    } else {
      pending.reject(new Error(message.error || 'Request failed'));
    }
  }

  /**
   * ACKメッセージの処理
   */
  private handleAck(message: AckMessage): void {
    console.log('[WebComm] Received ACK for request:', message.requestId);
    this.isConnected = true;
  }

  /**
   * 通知メッセージの処理
   */
  private async handleNotification(message: NotificationMessage): Promise<void> {
    this.isConnected = true;

    // 通知ハンドラー（同期的）を実行
    const notificationHandler = this.notificationHandlers.get(message.command);
    if (notificationHandler) {
      try {
        notificationHandler(message.data);
      } catch (error) {
        console.error('[WebComm] Notification handler error:', error);
      }
    }

    // リクエストハンドラー（非同期）も試す
    const requestHandler = this.messageHandlers.get(message.command);
    if (requestHandler) {
      try {
        await requestHandler(message.data);
      } catch (error) {
        console.error('[WebComm] Message handler error:', error);
      }
    }
  }

  /**
   * リクエストメッセージの送信（レスポンス待ち）
   */
  public async sendRequest<T = any>(
    command: WebviewCommand,
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
  public sendNotification(command: WebviewCommand, data?: any): void {
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
   * メッセージの実際の送信
   */
  private postMessage(message: ProtocolMessage): void {
    if (!this.vscodeApi) {
      console.error('[WebComm] VSCode API not available');
      return;
    }

    try {
      this.vscodeApi.postMessage(message);
      console.log('[WebComm] Sent message:', message.type, message.command, message.id);
    } catch (error) {
      console.error('[WebComm] Failed to post message:', error);
      throw error;
    }
  }

  /**
   * メッセージハンドラーの登録（非同期）
   */
  public registerHandler(command: string, handler: (data: any) => Promise<any>): void {
    this.messageHandlers.set(command, handler);
    console.log('[WebComm] Registered handler for command:', command);
  }

  /**
   * 通知ハンドラーの登録（同期）
   */
  public registerNotificationHandler(command: string, handler: (data: any) => void): void {
    this.notificationHandlers.set(command, handler);
    console.log('[WebComm] Registered notification handler for command:', command);
  }

  /**
   * メッセージハンドラーの登録解除
   */
  public unregisterHandler(command: string): void {
    this.messageHandlers.delete(command);
    this.notificationHandlers.delete(command);
  }

  /**
   * 接続状態の確認
   */
  public isExtensionConnected(): boolean {
    // 最後のメッセージから一定時間経過していなければ接続中とみなす
    const timeSinceLastMessage = Date.now() - this.lastMessageTime;
    return this.isConnected && timeSinceLastMessage < this.config.heartbeatInterval * 2;
  }

  /**
   * クリーンアップ
   */
  public dispose(): void {
    console.log('[WebComm] Disposing communication manager');

    // 保留中のリクエストをすべてキャンセル
    for (const [id, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Communication manager disposed'));
    }
    this.pendingRequests.clear();

    // メッセージリスナーを削除
    if (this.messageListener) {
      window.removeEventListener('message', this.messageListener);
      this.messageListener = null;
    }

    // ハンドラーをクリア
    this.messageHandlers.clear();
    this.notificationHandlers.clear();
  }

  // ============================================
  // 便利メソッド：Webview -> Extension
  // ============================================

  /**
   * テーブルデータをリクエスト
   */
  public async requestTableData(): Promise<any> {
    return this.sendRequest(WebviewCommand.REQUEST_TABLE_DATA);
  }

  /**
   * セルを更新
   */
  public updateCell(row: number, col: number, value: string, tableIndex?: number): void {
    this.sendNotification(WebviewCommand.UPDATE_CELL, { row, col, value, tableIndex });
  }

  /**
   * 複数セルを一括更新
   */
  public bulkUpdateCells(updates: Array<{ row: number; col: number; value: string }>, tableIndex?: number): void {
    this.sendNotification(WebviewCommand.BULK_UPDATE_CELLS, { updates, tableIndex });
  }

  /**
   * ヘッダーを更新
   */
  public updateHeader(col: number, value: string, tableIndex?: number): void {
    this.sendNotification(WebviewCommand.UPDATE_HEADER, { col, value, tableIndex });
  }

  /**
   * 行を追加
   */
  public addRow(index?: number, count?: number, tableIndex?: number): void {
    this.sendNotification(WebviewCommand.ADD_ROW, { index, count, tableIndex });
  }

  /**
   * 行を削除
   */
  public deleteRows(indices: number[], tableIndex?: number): void {
    this.sendNotification(WebviewCommand.DELETE_ROWS, { indices, tableIndex });
  }

  /**
   * 列を追加
   */
  public addColumn(index?: number, tableIndex?: number): void {
    this.sendNotification(WebviewCommand.ADD_COLUMN, { index, tableIndex });
  }

  /**
   * 列を削除
   */
  public deleteColumns(indices: number[], tableIndex?: number): void {
    this.sendNotification(WebviewCommand.DELETE_COLUMNS, { indices, tableIndex });
  }

  /**
   * ソート
   */
  public sort(column: number, direction: 'asc' | 'desc' | 'none', tableIndex?: number): void {
    this.sendNotification(WebviewCommand.SORT, { column, direction, tableIndex });
  }

  /**
   * 行を移動
   */
  public moveRow(fromIndex: number, toIndex: number, tableIndex?: number): void {
    this.sendNotification(WebviewCommand.MOVE_ROW, { fromIndex, toIndex, tableIndex });
  }

  /**
   * 列を移動
   */
  public moveColumn(fromIndex: number, toIndex: number, tableIndex?: number): void {
    this.sendNotification(WebviewCommand.MOVE_COLUMN, { fromIndex, toIndex, tableIndex });
  }

  /**
   * CSVエクスポート
   */
  public exportCSV(csvContent: string, filename?: string, encoding?: string, tableIndex?: number): void {
    this.sendNotification(WebviewCommand.EXPORT_CSV, { csvContent, filename, encoding, tableIndex });
  }

  /**
   * テーブル切り替え
   */
  public switchTable(index: number): void {
    this.sendNotification(WebviewCommand.SWITCH_TABLE, { index });
  }

  /**
   * テーマ変数をリクエスト
   */
  public async requestThemeVariables(): Promise<any> {
    return this.sendRequest(WebviewCommand.REQUEST_THEME_VARIABLES);
  }

  /**
   * Undo
   */
  public undo(): void {
    this.sendNotification(WebviewCommand.UNDO);
  }

  /**
   * Redo
   */
  public redo(): void {
    this.sendNotification(WebviewCommand.REDO);
  }

  /**
   * Pong応答
   */
  public sendPong(timestamp: number): void {
    this.sendNotification(WebviewCommand.PONG, { timestamp, responseTime: Date.now() });
  }

  /**
   * 状態同期をリクエスト
   */
  public requestSync(): void {
    this.sendNotification(WebviewCommand.REQUEST_SYNC);
  }
}
