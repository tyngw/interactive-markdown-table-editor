import { WebviewCommunicationManager } from '../../communication/WebviewCommunicationManager';
import { WebviewCommand, MessageType } from '../../../../src/communication/protocol';

/**
 * WebviewCommunicationManager テスト
 *
 * 全メソッド・全分岐を網羅し、カバレッジ100%を目指す
 */

// window.addEventListener / removeEventListener のスパイ
let addEventListenerSpy: jest.SpyInstance;
let removeEventListenerSpy: jest.SpyInstance;

describe('WebviewCommunicationManager', () => {
  let manager: WebviewCommunicationManager;
  let mockVSCodeApi: any;
  let sentMessages: any[];
  // messageイベントリスナーを保持して手動でイベントを送信するための変数
  let messageListener: ((event: MessageEvent) => void) | null = null;

  beforeEach(() => {
    sentMessages = [];
    mockVSCodeApi = {
      postMessage: jest.fn((message: any) => {
        sentMessages.push(message);
      }),
      getState: jest.fn(),
      setState: jest.fn()
    };

    // addEventListener をスパイして、messageリスナーを保存
    addEventListenerSpy = jest.spyOn(window, 'addEventListener').mockImplementation(
      (type: string, listener: any) => {
        if (type === 'message') {
          messageListener = listener;
        }
      }
    );
    removeEventListenerSpy = jest.spyOn(window, 'removeEventListener').mockImplementation(
      (type: string, listener: any) => {
        if (type === 'message' && listener === messageListener) {
          messageListener = null;
        }
      }
    );

    manager = new WebviewCommunicationManager(mockVSCodeApi);
  });

  afterEach(() => {
    // pendingRequestsをクリアしてからdisposeして未ハンドルのrejectを防止
    (manager as any).pendingRequests.clear();
    manager.dispose();
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
    messageListener = null;
  });

  /**
   * テスト用ヘルパー: MessageEvent をシミュレートして受信メッセージを処理
   */
  function simulateMessage(data: any): void {
    if (messageListener) {
      messageListener(new MessageEvent('message', { data }));
    }
  }

  // ============================================
  // コンストラクタとセットアップ
  // ============================================

  describe('コンストラクタ', () => {
    test('デフォルト設定で初期化されること', () => {
      expect(manager).toBeDefined();
      expect(addEventListenerSpy).toHaveBeenCalledWith('message', expect.any(Function));
    });

    test('カスタム設定で初期化されること', () => {
      const customManager = new WebviewCommunicationManager(mockVSCodeApi, {
        defaultTimeout: 5000,
        maxRetries: 5
      });
      expect(customManager).toBeDefined();
      customManager.dispose();
    });
  });

  // ============================================
  // handleIncomingMessage のテスト
  // ============================================

  describe('handleIncomingMessage', () => {
    test('nullメッセージは無視されること', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      simulateMessage(null);
      expect(warnSpy).toHaveBeenCalledWith(
        '[WebComm] Invalid message format (not an object):',
        null
      );
      warnSpy.mockRestore();
    });

    test('非オブジェクトメッセージは無視されること', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      simulateMessage('invalid string');
      expect(warnSpy).toHaveBeenCalledWith(
        '[WebComm] Invalid message format (not an object):',
        'invalid string'
      );
      warnSpy.mockRestore();
    });

    test('必須フィールド不足のメッセージは無視されること（typeのみ）', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      simulateMessage({ type: MessageType.NOTIFICATION });
      expect(warnSpy).toHaveBeenCalledWith(
        '[WebComm] Invalid protocol message (missing required fields):',
        expect.any(Object)
      );
      warnSpy.mockRestore();
    });

    test('必須フィールド不足のメッセージは無視されること（idなし）', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      simulateMessage({ type: MessageType.NOTIFICATION, command: 'test', timestamp: 123 });
      expect(warnSpy).toHaveBeenCalledWith(
        '[WebComm] Invalid protocol message (missing required fields):',
        expect.any(Object)
      );
      warnSpy.mockRestore();
    });

    test('必須フィールド不足のメッセージは無視されること（commandなし）', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      simulateMessage({ type: MessageType.NOTIFICATION, id: 'x', timestamp: 123 });
      expect(warnSpy).toHaveBeenCalledWith(
        '[WebComm] Invalid protocol message (missing required fields):',
        expect.any(Object)
      );
      warnSpy.mockRestore();
    });

    test('必須フィールド不足のメッセージは無視されること（timestampなし）', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      simulateMessage({ type: MessageType.NOTIFICATION, id: 'x', command: 'test' });
      expect(warnSpy).toHaveBeenCalledWith(
        '[WebComm] Invalid protocol message (missing required fields):',
        expect.any(Object)
      );
      warnSpy.mockRestore();
    });

    test('ERRORタイプのメッセージはエラーログが出力されること', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      simulateMessage({
        id: 'test-1',
        type: MessageType.ERROR,
        command: 'error',
        timestamp: Date.now(),
        error: 'Something went wrong'
      });
      expect(errorSpy).toHaveBeenCalledWith(
        '[WebComm] Received error message:',
        expect.objectContaining({ type: MessageType.ERROR })
      );
      errorSpy.mockRestore();
      logSpy.mockRestore();
    });

    test('未知のメッセージタイプはwarnが出力されること', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      simulateMessage({
        id: 'test-1',
        type: 'unknown_type',
        command: 'test',
        timestamp: Date.now()
      });
      expect(warnSpy).toHaveBeenCalledWith(
        '[WebComm] Unknown message type:',
        'unknown_type'
      );
      warnSpy.mockRestore();
      logSpy.mockRestore();
    });

    test('handleIncomingMessage のtry-catchブロックに到達すること', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      // handleResponse内で同期的にthrowさせるため、pendingRequestsのgetを壊す
      const originalGet = (manager as any).pendingRequests.get;
      (manager as any).pendingRequests.get = () => {
        throw new Error('Unexpected internal error');
      };

      simulateMessage({
        id: 'crash-1',
        type: MessageType.RESPONSE,
        command: 'response',
        requestId: 'any-id',
        success: true,
        timestamp: Date.now()
      });

      // handleIncomingMessageのcatchに到達
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(errorSpy).toHaveBeenCalledWith(
        '[WebComm] Error handling message:',
        expect.any(Error)
      );

      // 元に戻す
      (manager as any).pendingRequests.get = originalGet;
      errorSpy.mockRestore();
      logSpy.mockRestore();
    });

    test('メッセージ処理中のエラーはキャッチされること', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      // ハンドラーが例外を投げるように設定
      manager.registerHandler('testCommand', async () => {
        throw new Error('Handler explosion');
      });

      simulateMessage({
        id: 'test-1',
        type: MessageType.REQUEST,
        command: 'testCommand',
        timestamp: Date.now(),
        data: {}
      });

      // 非同期処理の完了を待つ
      await new Promise(resolve => setTimeout(resolve, 10));

      // ハンドラーエラーのログを確認（handleRequest内でキャッチされる）
      expect(errorSpy).toHaveBeenCalledWith(
        '[WebComm] Handler error:',
        expect.any(Error)
      );
      errorSpy.mockRestore();
      logSpy.mockRestore();
    });
  });

  // ============================================
  // handleRequest のテスト
  // ============================================

  describe('handleRequest', () => {
    test('ハンドラーが登録されていない場合、エラーレスポンスが送信されること', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      simulateMessage({
        id: 'req-1',
        type: MessageType.REQUEST,
        command: 'unknownCommand',
        timestamp: Date.now(),
        data: {}
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(warnSpy).toHaveBeenCalledWith(
        '[WebComm] No handler for command:',
        'unknownCommand'
      );

      // ACK + エラーレスポンスが送信されたことを確認
      const ackMessage = sentMessages.find(m => m.type === MessageType.ACK);
      expect(ackMessage).toBeDefined();
      expect(ackMessage.requestId).toBe('req-1');

      const responseMessage = sentMessages.find(m => m.type === MessageType.RESPONSE);
      expect(responseMessage).toBeDefined();
      expect(responseMessage.success).toBe(false);
      expect(responseMessage.error).toContain('No handler for command');

      warnSpy.mockRestore();
      logSpy.mockRestore();
    });

    test('ハンドラーが正常に実行された場合、成功レスポンスが送信されること', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      manager.registerHandler('testCmd', async (data) => {
        return { result: 'ok', input: data };
      });

      simulateMessage({
        id: 'req-2',
        type: MessageType.REQUEST,
        command: 'testCmd',
        timestamp: Date.now(),
        data: { foo: 'bar' }
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      const responseMessage = sentMessages.find(m => m.type === MessageType.RESPONSE);
      expect(responseMessage).toBeDefined();
      expect(responseMessage.success).toBe(true);
      expect(responseMessage.data).toEqual({ result: 'ok', input: { foo: 'bar' } });
      expect(responseMessage.requestId).toBe('req-2');

      logSpy.mockRestore();
    });

    test('ハンドラーがError以外の例外を投げた場合、文字列化されること', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      manager.registerHandler('testCmd', async () => {
        throw 'string error'; // eslint-disable-line no-throw-literal
      });

      simulateMessage({
        id: 'req-3',
        type: MessageType.REQUEST,
        command: 'testCmd',
        timestamp: Date.now(),
        data: {}
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      const responseMessage = sentMessages.find(m => m.type === MessageType.RESPONSE);
      expect(responseMessage).toBeDefined();
      expect(responseMessage.success).toBe(false);
      expect(responseMessage.error).toBe('string error');

      errorSpy.mockRestore();
      logSpy.mockRestore();
    });

    test('ハンドラーがErrorインスタンスを投げた場合、messageが使われること', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      manager.registerHandler('errorCmd', async () => {
        throw new Error('specific error message');
      });

      simulateMessage({
        id: 'req-4',
        type: MessageType.REQUEST,
        command: 'errorCmd',
        timestamp: Date.now(),
        data: {}
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      const responseMessage = sentMessages.find(m => m.type === MessageType.RESPONSE);
      expect(responseMessage).toBeDefined();
      expect(responseMessage.success).toBe(false);
      expect(responseMessage.error).toBe('specific error message');

      errorSpy.mockRestore();
      logSpy.mockRestore();
    });
  });

  // ============================================
  // handleResponse のテスト
  // ============================================

  describe('handleResponse', () => {
    test('pendingリクエストが存在しない場合、warnが出力されること', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      simulateMessage({
        id: 'resp-1',
        type: MessageType.RESPONSE,
        command: 'response',
        requestId: 'nonexistent-req',
        success: true,
        timestamp: Date.now()
      });

      expect(warnSpy).toHaveBeenCalledWith(
        '[WebComm] Received response for unknown request:',
        'nonexistent-req'
      );
      warnSpy.mockRestore();
      logSpy.mockRestore();
    });

    test('成功レスポンスがpendingリクエストをresolveすること', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      // sendRequestでpendingリクエストを作成
      const requestPromise = manager.sendRequest(WebviewCommand.REQUEST_TABLE_DATA);

      // 送信されたメッセージからIDを取得
      const sentRequest = sentMessages[0];

      // 成功レスポンスをシミュレート
      simulateMessage({
        id: 'resp-2',
        type: MessageType.RESPONSE,
        command: 'response',
        requestId: sentRequest.id,
        success: true,
        data: { tables: [] },
        timestamp: Date.now()
      });

      const result = await requestPromise;
      expect(result).toEqual({ tables: [] });

      logSpy.mockRestore();
    });

    test('失敗レスポンスがpendingリクエストをrejectすること', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      const requestPromise = manager.sendRequest(WebviewCommand.REQUEST_TABLE_DATA);

      const sentRequest = sentMessages[0];

      simulateMessage({
        id: 'resp-3',
        type: MessageType.RESPONSE,
        command: 'response',
        requestId: sentRequest.id,
        success: false,
        error: 'Something failed',
        timestamp: Date.now()
      });

      await expect(requestPromise).rejects.toThrow('Something failed');

      logSpy.mockRestore();
    });

    test('エラーメッセージが未指定の場合、デフォルトメッセージでrejectすること', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      const requestPromise = manager.sendRequest(WebviewCommand.REQUEST_TABLE_DATA);

      const sentRequest = sentMessages[0];

      simulateMessage({
        id: 'resp-4',
        type: MessageType.RESPONSE,
        command: 'response',
        requestId: sentRequest.id,
        success: false,
        timestamp: Date.now()
      });

      await expect(requestPromise).rejects.toThrow('Request failed');

      logSpy.mockRestore();
    });
  });

  // ============================================
  // handleAck のテスト
  // ============================================

  describe('handleAck', () => {
    test('ACKメッセージを受信して接続状態が更新されること', () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      simulateMessage({
        id: 'ack-1',
        type: MessageType.ACK,
        command: 'ack',
        requestId: 'some-req',
        timestamp: Date.now()
      });

      expect(logSpy).toHaveBeenCalledWith(
        '[WebComm] Received ACK for request:',
        'some-req'
      );

      logSpy.mockRestore();
    });
  });

  // ============================================
  // handleNotification のテスト
  // ============================================

  describe('handleNotification', () => {
    test('通知ハンドラーが実行されること', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      const handler = jest.fn();
      manager.registerNotificationHandler('testNotif', handler);

      simulateMessage({
        id: 'notif-1',
        type: MessageType.NOTIFICATION,
        command: 'testNotif',
        timestamp: Date.now(),
        data: { key: 'value' }
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledWith({ key: 'value' });

      logSpy.mockRestore();
    });

    test('リクエストハンドラーも通知で実行されること', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      const asyncHandler = jest.fn().mockResolvedValue('done');
      manager.registerHandler('testNotif', asyncHandler);

      simulateMessage({
        id: 'notif-2',
        type: MessageType.NOTIFICATION,
        command: 'testNotif',
        timestamp: Date.now(),
        data: { key: 'value' }
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(asyncHandler).toHaveBeenCalledWith({ key: 'value' });

      logSpy.mockRestore();
    });

    test('通知ハンドラーとリクエストハンドラーの両方が実行されること', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      const notifHandler = jest.fn();
      const reqHandler = jest.fn().mockResolvedValue('ok');

      manager.registerNotificationHandler('dualCmd', notifHandler);
      manager.registerHandler('dualCmd', reqHandler);

      simulateMessage({
        id: 'notif-3',
        type: MessageType.NOTIFICATION,
        command: 'dualCmd',
        timestamp: Date.now(),
        data: { dual: true }
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(notifHandler).toHaveBeenCalledWith({ dual: true });
      expect(reqHandler).toHaveBeenCalledWith({ dual: true });

      logSpy.mockRestore();
    });

    test('通知ハンドラーのエラーがキャッチされること', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      manager.registerNotificationHandler('errorNotif', () => {
        throw new Error('Notification handler error');
      });

      simulateMessage({
        id: 'notif-4',
        type: MessageType.NOTIFICATION,
        command: 'errorNotif',
        timestamp: Date.now(),
        data: {}
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(errorSpy).toHaveBeenCalledWith(
        '[WebComm] Notification handler error:',
        expect.any(Error)
      );

      errorSpy.mockRestore();
      logSpy.mockRestore();
    });

    test('リクエストハンドラーのエラーがキャッチされること（通知時）', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      manager.registerHandler('errorReqNotif', async () => {
        throw new Error('Request handler error on notification');
      });

      simulateMessage({
        id: 'notif-5',
        type: MessageType.NOTIFICATION,
        command: 'errorReqNotif',
        timestamp: Date.now(),
        data: {}
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(errorSpy).toHaveBeenCalledWith(
        '[WebComm] Message handler error:',
        expect.any(Error)
      );

      errorSpy.mockRestore();
      logSpy.mockRestore();
    });

    test('ハンドラーが登録されていない通知も正常に処理されること', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      simulateMessage({
        id: 'notif-6',
        type: MessageType.NOTIFICATION,
        command: 'noHandlerNotif',
        timestamp: Date.now(),
        data: { orphan: true }
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      // エラーなく処理が完了することを確認
      expect(logSpy).toHaveBeenCalledWith(
        '[WebComm] Notification received:',
        'noHandlerNotif',
        'data:',
        { orphan: true }
      );

      logSpy.mockRestore();
    });

    test('通知のログ出力でエラーが発生した場合のcatchブロックに到達すること', async () => {
      // console.logを一度だけ例外を投げさせてcatchブロックに入る
      let callCount = 0;
      const logSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {
        callCount++;
        // handleIncomingMessageの「Received message:」ログ（1回目）は通す
        // handleNotificationの最初のconsole.log（2回目）で例外を投げる
        if (callCount === 2) {
          throw new Error('console.log failed');
        }
      });

      simulateMessage({
        id: 'notif-7',
        type: MessageType.NOTIFICATION,
        command: 'logFailNotif',
        timestamp: Date.now(),
        data: { test: true }
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      // catchブロックのフォールバックログが呼ばれたことを確認
      expect(logSpy).toHaveBeenCalledWith(
        '[WebComm] Notification received (could not stringify data):',
        'logFailNotif'
      );

      logSpy.mockRestore();
    });
  });

  // ============================================
  // sendRequest のテスト
  // ============================================

  describe('sendRequest', () => {
    test('リクエストメッセージが正しい形式で送信されること', () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      manager.sendRequest(WebviewCommand.REQUEST_TABLE_DATA);

      expect(sentMessages.length).toBe(1);
      const message = sentMessages[0];
      expect(message.type).toBe(MessageType.REQUEST);
      expect(message.command).toBe(WebviewCommand.REQUEST_TABLE_DATA);
      expect(message.expectResponse).toBe(true);
      expect(message.id).toBeDefined();
      expect(message.timestamp).toBeDefined();

      logSpy.mockRestore();
    });

    test('カスタムタイムアウトが設定されること', () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      manager.sendRequest(WebviewCommand.REQUEST_TABLE_DATA, undefined, 5000);

      const message = sentMessages[0];
      expect(message.timeout).toBe(5000);

      logSpy.mockRestore();
    });

    test('タイムアウト時にrejectされること', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      jest.useFakeTimers();

      const requestPromise = manager.sendRequest(
        WebviewCommand.REQUEST_TABLE_DATA,
        undefined,
        100
      );

      jest.advanceTimersByTime(101);

      await expect(requestPromise).rejects.toThrow('Request timeout: requestTableData');

      jest.useRealTimers();
      logSpy.mockRestore();
    });

    test('データ付きリクエストが送信されること', () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      manager.sendRequest(WebviewCommand.REQUEST_TABLE_DATA, { extra: 'data' });

      const message = sentMessages[0];
      expect(message.data).toEqual({ extra: 'data' });

      logSpy.mockRestore();
    });
  });

  // ============================================
  // sendNotification のテスト
  // ============================================

  describe('sendNotification', () => {
    test('通知メッセージが正しい形式で送信されること', () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      manager.sendNotification(WebviewCommand.UNDO);

      expect(sentMessages.length).toBe(1);
      const message = sentMessages[0];
      expect(message.type).toBe(MessageType.NOTIFICATION);
      expect(message.command).toBe(WebviewCommand.UNDO);

      logSpy.mockRestore();
    });
  });

  // ============================================
  // postMessage のテスト
  // ============================================

  describe('postMessage', () => {
    test('vscodeApiがnullの場合、エラーログが出力されること', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      const nullManager = new WebviewCommunicationManager(null as any);
      nullManager.sendNotification(WebviewCommand.UNDO);

      expect(errorSpy).toHaveBeenCalledWith('[WebComm] VSCode API not available');
      // postMessageは呼ばれないこと
      expect(mockVSCodeApi.postMessage).not.toHaveBeenCalled();

      nullManager.dispose();
      errorSpy.mockRestore();
    });

    test('postMessageが例外を投げた場合、エラーが再スローされること', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      mockVSCodeApi.postMessage.mockImplementation(() => {
        throw new Error('Post failed');
      });

      expect(() => {
        manager.sendNotification(WebviewCommand.UNDO);
      }).toThrow('Post failed');

      expect(errorSpy).toHaveBeenCalledWith(
        '[WebComm] Failed to post message:',
        expect.any(Error)
      );

      errorSpy.mockRestore();
    });
  });

  // ============================================
  // ハンドラー登録/解除のテスト
  // ============================================

  describe('ハンドラー登録・解除', () => {
    test('registerHandlerでメッセージハンドラーが登録されること', () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      const handler = jest.fn().mockResolvedValue(undefined);
      manager.registerHandler('testCmd', handler);

      expect(logSpy).toHaveBeenCalledWith(
        '[WebComm] Registered handler for command:',
        'testCmd'
      );

      logSpy.mockRestore();
    });

    test('registerNotificationHandlerで通知ハンドラーが登録されること', () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      const handler = jest.fn();
      manager.registerNotificationHandler('testNotif', handler);

      expect(logSpy).toHaveBeenCalledWith(
        '[WebComm] Registered notification handler for command:',
        'testNotif'
      );

      logSpy.mockRestore();
    });

    test('unregisterHandlerで両方のハンドラーが削除されること', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      const reqHandler = jest.fn().mockResolvedValue('ok');
      const notifHandler = jest.fn();

      manager.registerHandler('cmdToRemove', reqHandler);
      manager.registerNotificationHandler('cmdToRemove', notifHandler);
      manager.unregisterHandler('cmdToRemove');

      // 通知を送信してもハンドラーが呼ばれないことを確認
      simulateMessage({
        id: 'unreg-1',
        type: MessageType.NOTIFICATION,
        command: 'cmdToRemove',
        timestamp: Date.now(),
        data: {}
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(reqHandler).not.toHaveBeenCalled();
      expect(notifHandler).not.toHaveBeenCalled();

      logSpy.mockRestore();
    });
  });

  // ============================================
  // isExtensionConnected のテスト
  // ============================================

  describe('isExtensionConnected', () => {
    test('初期状態ではfalseを返すこと', () => {
      expect(manager.isExtensionConnected()).toBe(false);
    });

    test('ACK受信後はtrueを返すこと', () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      simulateMessage({
        id: 'ack-conn-1',
        type: MessageType.ACK,
        command: 'ack',
        requestId: 'req-1',
        timestamp: Date.now()
      });

      expect(manager.isExtensionConnected()).toBe(true);

      logSpy.mockRestore();
    });

    test('成功レスポンス受信後はtrueを返すこと', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      const requestPromise = manager.sendRequest(WebviewCommand.REQUEST_TABLE_DATA);
      const sentRequest = sentMessages[0];

      simulateMessage({
        id: 'resp-conn',
        type: MessageType.RESPONSE,
        command: 'response',
        requestId: sentRequest.id,
        success: true,
        data: {},
        timestamp: Date.now()
      });

      await requestPromise;
      expect(manager.isExtensionConnected()).toBe(true);

      logSpy.mockRestore();
    });

    test('通知受信後はtrueを返すこと', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      simulateMessage({
        id: 'notif-conn',
        type: MessageType.NOTIFICATION,
        command: 'someNotif',
        timestamp: Date.now(),
        data: {}
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(manager.isExtensionConnected()).toBe(true);

      logSpy.mockRestore();
    });

    test('heartbeatInterval * 2 を超えた場合はfalseを返すこと', () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      // まず接続状態にする
      simulateMessage({
        id: 'ack-exp',
        type: MessageType.ACK,
        command: 'ack',
        requestId: 'req-x',
        timestamp: Date.now()
      });

      expect(manager.isExtensionConnected()).toBe(true);

      // lastMessageTime を十分過去に設定
      (manager as any).lastMessageTime = Date.now() - 100000;

      expect(manager.isExtensionConnected()).toBe(false);

      logSpy.mockRestore();
    });
  });

  // ============================================
  // dispose のテスト
  // ============================================

  describe('dispose', () => {
    test('保留中のリクエストがすべてキャンセルされること', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      jest.useFakeTimers();

      // 専用のmanagerを作成してafterEachの二重disposeを回避
      const disposeManager = new WebviewCommunicationManager(mockVSCodeApi);
      const promise1 = disposeManager.sendRequest(WebviewCommand.REQUEST_TABLE_DATA);
      const promise2 = disposeManager.sendRequest(WebviewCommand.REQUEST_THEME_VARIABLES);

      disposeManager.dispose();

      await expect(promise1).rejects.toThrow('Communication manager disposed');
      await expect(promise2).rejects.toThrow('Communication manager disposed');

      jest.useRealTimers();
      logSpy.mockRestore();
    });

    test('メッセージリスナーが削除されること', () => {
      manager.dispose();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('message', expect.any(Function));
    });

    test('複数回disposeしても安全であること', () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      // 専用のmanagerを作成
      const disposeManager = new WebviewCommunicationManager(mockVSCodeApi);
      disposeManager.dispose();
      // 2回目のdisposeでmessageListenerはnullなのでremoveEventListenerは呼ばれない
      disposeManager.dispose();

      logSpy.mockRestore();
    });
  });

  // ============================================
  // 便利メソッドのテスト
  // ============================================

  describe('便利メソッド（Webview -> Extension）', () => {
    let logSpy: jest.SpyInstance;

    beforeEach(() => {
      logSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      logSpy.mockRestore();
    });

    test('requestTableData がリクエストを送信すること', () => {
      manager.requestTableData();
      const message = sentMessages[0];
      expect(message.type).toBe(MessageType.REQUEST);
      expect(message.command).toBe(WebviewCommand.REQUEST_TABLE_DATA);
    });

    test('updateCell が正しいデータで通知を送信すること', () => {
      manager.updateCell(1, 2, 'test');
      const message = sentMessages[0];
      expect(message.command).toBe(WebviewCommand.UPDATE_CELL);
      expect(message.data).toEqual({ row: 1, col: 2, value: 'test', tableIndex: undefined });
    });

    test('updateCell がtableIndex付きで通知を送信すること', () => {
      manager.updateCell(0, 0, 'value', 3);
      const message = sentMessages[0];
      expect(message.data).toEqual({ row: 0, col: 0, value: 'value', tableIndex: 3 });
    });

    test('bulkUpdateCells が正しいデータで通知を送信すること', () => {
      const updates = [
        { row: 0, col: 0, value: 'a' },
        { row: 1, col: 1, value: 'b' }
      ];
      manager.bulkUpdateCells(updates, 1);
      const message = sentMessages[0];
      expect(message.command).toBe(WebviewCommand.BULK_UPDATE_CELLS);
      expect(message.data).toEqual({ updates, tableIndex: 1 });
    });

    test('bulkUpdateCells がtableIndexなしで動作すること', () => {
      const updates = [{ row: 0, col: 0, value: 'x' }];
      manager.bulkUpdateCells(updates);
      const message = sentMessages[0];
      expect(message.data).toEqual({ updates, tableIndex: undefined });
    });

    test('updateHeader が正しいデータで通知を送信すること', () => {
      manager.updateHeader(0, 'Header1', 2);
      const message = sentMessages[0];
      expect(message.command).toBe(WebviewCommand.UPDATE_HEADER);
      expect(message.data).toEqual({ col: 0, value: 'Header1', tableIndex: 2 });
    });

    test('updateHeader がtableIndexなしで動作すること', () => {
      manager.updateHeader(1, 'H');
      const message = sentMessages[0];
      expect(message.data).toEqual({ col: 1, value: 'H', tableIndex: undefined });
    });

    test('addRow が正しいデータで通知を送信すること', () => {
      manager.addRow(5, 2, 1);
      const message = sentMessages[0];
      expect(message.command).toBe(WebviewCommand.ADD_ROW);
      expect(message.data).toEqual({ index: 5, count: 2, tableIndex: 1 });
    });

    test('addRow がパラメータなしでも動作すること', () => {
      manager.addRow();
      const message = sentMessages[0];
      expect(message.command).toBe(WebviewCommand.ADD_ROW);
      expect(message.data).toEqual({ index: undefined, count: undefined, tableIndex: undefined });
    });

    test('deleteRows が正しいデータで通知を送信すること', () => {
      manager.deleteRows([0, 2], 1);
      const message = sentMessages[0];
      expect(message.command).toBe(WebviewCommand.DELETE_ROWS);
      expect(message.data).toEqual({ indices: [0, 2], tableIndex: 1 });
    });

    test('deleteRows がtableIndexなしで動作すること', () => {
      manager.deleteRows([3]);
      const message = sentMessages[0];
      expect(message.data).toEqual({ indices: [3], tableIndex: undefined });
    });

    test('addColumn が正しいデータで通知を送信すること', () => {
      manager.addColumn(3, 1, 0);
      const message = sentMessages[0];
      expect(message.command).toBe(WebviewCommand.ADD_COLUMN);
      expect(message.data).toEqual({ index: 3, count: 1, tableIndex: 0 });
    });

    test('addColumn がパラメータなしでも動作すること', () => {
      manager.addColumn();
      const message = sentMessages[0];
      expect(message.command).toBe(WebviewCommand.ADD_COLUMN);
      expect(message.data).toEqual({ index: undefined, count: undefined, tableIndex: undefined });
    });

    test('deleteColumns が正しいデータで通知を送信すること', () => {
      manager.deleteColumns([1, 3], 0);
      const message = sentMessages[0];
      expect(message.command).toBe(WebviewCommand.DELETE_COLUMNS);
      expect(message.data).toEqual({ indices: [1, 3], tableIndex: 0 });
    });

    test('deleteColumns がtableIndexなしで動作すること', () => {
      manager.deleteColumns([0]);
      const message = sentMessages[0];
      expect(message.data).toEqual({ indices: [0], tableIndex: undefined });
    });

    test('sort が正しいデータで通知を送信すること', () => {
      manager.sort(0, 'asc', 1);
      const message = sentMessages[0];
      expect(message.command).toBe(WebviewCommand.SORT);
      expect(message.data).toEqual({ column: 0, direction: 'asc', tableIndex: 1 });
    });

    test('sort がdesc方向で動作すること', () => {
      manager.sort(2, 'desc');
      const message = sentMessages[0];
      expect(message.data).toEqual({ column: 2, direction: 'desc', tableIndex: undefined });
    });

    test('sort がnone方向で動作すること', () => {
      manager.sort(1, 'none');
      const message = sentMessages[0];
      expect(message.data).toEqual({ column: 1, direction: 'none', tableIndex: undefined });
    });

    test('moveRow が正しいデータで通知を送信すること', () => {
      manager.moveRow(0, 2, 1, [0, 1]);
      const message = sentMessages[0];
      expect(message.command).toBe(WebviewCommand.MOVE_ROW);
      expect(message.data).toEqual({ fromIndex: 0, toIndex: 2, tableIndex: 1, indices: [0, 1] });
    });

    test('moveRow がindicesなしで動作すること', () => {
      manager.moveRow(1, 3);
      const message = sentMessages[0];
      expect(message.data).toEqual({ fromIndex: 1, toIndex: 3, tableIndex: undefined, indices: undefined });
    });

    test('moveColumn が正しいデータで通知を送信すること', () => {
      manager.moveColumn(0, 3, 0, [0, 2]);
      const message = sentMessages[0];
      expect(message.command).toBe(WebviewCommand.MOVE_COLUMN);
      expect(message.data).toEqual({ fromIndex: 0, toIndex: 3, tableIndex: 0, indices: [0, 2] });
    });

    test('moveColumn がindicesなしで動作すること', () => {
      manager.moveColumn(2, 0);
      const message = sentMessages[0];
      expect(message.data).toEqual({ fromIndex: 2, toIndex: 0, tableIndex: undefined, indices: undefined });
    });

    test('exportCSV が正しいデータで通知を送信すること', () => {
      manager.exportCSV('a,b\n1,2', 'test.csv', 'utf-8', 0);
      const message = sentMessages[0];
      expect(message.command).toBe(WebviewCommand.EXPORT_CSV);
      expect(message.data).toEqual({
        csvContent: 'a,b\n1,2',
        filename: 'test.csv',
        encoding: 'utf-8',
        tableIndex: 0
      });
    });

    test('exportCSV がオプションパラメータなしで動作すること', () => {
      manager.exportCSV('data');
      const message = sentMessages[0];
      expect(message.data).toEqual({
        csvContent: 'data',
        filename: undefined,
        encoding: undefined,
        tableIndex: undefined
      });
    });

    test('importCSV が正しいデータで通知を送信すること', () => {
      manager.importCSV(2);
      const message = sentMessages[0];
      expect(message.command).toBe(WebviewCommand.IMPORT_CSV);
      expect(message.data).toEqual({ tableIndex: 2 });
    });

    test('importCSV がtableIndexなしで動作すること', () => {
      manager.importCSV();
      const message = sentMessages[0];
      expect(message.data).toEqual({ tableIndex: undefined });
    });

    test('switchTable が正しいデータで通知を送信すること', () => {
      manager.switchTable(3);
      const message = sentMessages[0];
      expect(message.command).toBe(WebviewCommand.SWITCH_TABLE);
      expect(message.data).toEqual({ index: 3 });
    });

    test('requestThemeVariables がリクエストを送信すること', () => {
      manager.requestThemeVariables();
      const message = sentMessages[0];
      expect(message.type).toBe(MessageType.REQUEST);
      expect(message.command).toBe(WebviewCommand.REQUEST_THEME_VARIABLES);
    });

    test('requestFontSettings がリクエストを送信すること', () => {
      manager.requestFontSettings();
      const message = sentMessages[0];
      expect(message.type).toBe(MessageType.REQUEST);
      expect(message.command).toBe(WebviewCommand.REQUEST_FONT_SETTINGS);
    });

    test('undo が通知を送信すること', () => {
      manager.undo();
      const message = sentMessages[0];
      expect(message.type).toBe(MessageType.NOTIFICATION);
      expect(message.command).toBe(WebviewCommand.UNDO);
    });

    test('redo が通知を送信すること', () => {
      manager.redo();
      const message = sentMessages[0];
      expect(message.type).toBe(MessageType.NOTIFICATION);
      expect(message.command).toBe(WebviewCommand.REDO);
    });

    test('sendPong が正しいデータで通知を送信すること', () => {
      const timestamp = Date.now();
      manager.sendPong(timestamp);
      const message = sentMessages[0];
      expect(message.command).toBe(WebviewCommand.PONG);
      expect(message.data.timestamp).toBe(timestamp);
      expect(message.data.responseTime).toBeDefined();
      expect(typeof message.data.responseTime).toBe('number');
    });

    test('requestSync が通知を送信すること', () => {
      manager.requestSync();
      const message = sentMessages[0];
      expect(message.type).toBe(MessageType.NOTIFICATION);
      expect(message.command).toBe(WebviewCommand.REQUEST_SYNC);
    });

    test('toggleAutoSave がtrueで通知を送信すること', () => {
      manager.toggleAutoSave(true);
      const message = sentMessages[0];
      expect(message.command).toBe(WebviewCommand.TOGGLE_AUTO_SAVE);
      expect(message.data).toEqual({ enabled: true });
    });

    test('toggleAutoSave がfalseで通知を送信すること', () => {
      manager.toggleAutoSave(false);
      const message = sentMessages[0];
      expect(message.data).toEqual({ enabled: false });
    });

    test('manualSave が通知を送信すること', () => {
      manager.manualSave();
      const message = sentMessages[0];
      expect(message.type).toBe(MessageType.NOTIFICATION);
      expect(message.command).toBe(WebviewCommand.MANUAL_SAVE);
    });
  });

  // ============================================
  // メッセージIDのユニーク性
  // ============================================

  describe('メッセージID', () => {
    test('複数メッセージのIDがすべてユニークであること', () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      manager.undo();
      manager.redo();
      manager.requestSync();
      manager.manualSave();
      manager.importCSV();

      const ids = sentMessages.map(m => m.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);

      logSpy.mockRestore();
    });
  });
});
