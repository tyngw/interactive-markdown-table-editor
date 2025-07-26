# IME（日本語入力）ハンドリングガイド

## 問題の概要

日本語入力システム（IME）を使用してセルを編集中に、日本語の確定（変換確定）を行うとセル編集も同時に確定してしまう問題があります。これは、IMEの確定時に発生するEnterキーイベントを、セル編集の確定として誤って処理してしまうためです。

## 技術的な背景

### IME Composition Events

日本語入力では以下のイベントシーケンスが発生します：

1. `compositionstart` - IME入力開始
2. `compositionupdate` - IME入力中（変換候補表示など）
3. `compositionend` - IME入力確定
4. `keydown` - Enterキーイベント（IME確定時）

### 問題のあるパターン

```javascript
// 問題のあるコード例
input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        // IMEの状態をチェックせずにセル編集を確定してしまう
        this.commitCellEdit();
    }
});
```

## 解決方法

### 1. IME状態の追跡

```javascript
// 状態管理
state.isComposing = false;

// IMEイベントリスナー
input.addEventListener('compositionstart', () => {
    state.isComposing = true;
});

input.addEventListener('compositionend', () => {
    state.isComposing = false;
});
```

### 2. キーイベントでのIME状態チェック

```javascript
input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        // IME入力中の場合は処理をスキップ
        if (state.isComposing) {
            return;
        }
        
        event.preventDefault();
        this.commitCellEdit();
    }
});
```

### 3. より堅牢な実装

```javascript
// compositionendイベント後の遅延処理
input.addEventListener('compositionend', () => {
    state.isComposing = false;
    
    // 少し遅延させてからフラグをクリア
    // これにより、compositionend直後のkeydownイベントを適切に処理できる
    setTimeout(() => {
        state.imeJustEnded = false;
    }, 10);
    state.imeJustEnded = true;
});

input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        // IME入力中、または直後の場合は処理をスキップ
        if (state.isComposing || state.imeJustEnded) {
            return;
        }
        
        event.preventDefault();
        this.commitCellEdit();
    }
});
```

## ベストプラクティス

### 1. 複数の状態フラグを使用

- `isComposing`: IME入力中かどうか
- `imeJustEnded`: IME入力が直前に終了したかどうか

### 2. イベントの順序を理解

1. `compositionend`
2. `keydown` (Enter)
3. `keyup` (Enter)

### 3. ブラウザ差異への対応

- Chrome, Firefox, Safari でIMEの動作が微妙に異なる場合がある
- 複数のブラウザでテストを行う

### 4. デバッグ用ログ

```javascript
input.addEventListener('compositionstart', (e) => {
    console.log('IME composition started');
    state.isComposing = true;
});

input.addEventListener('compositionend', (e) => {
    console.log('IME composition ended:', e.data);
    state.isComposing = false;
});

input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        console.log('Enter pressed, isComposing:', state.isComposing);
    }
});
```

## 関連する問題

### 1. 他の入力メソッドとの互換性

- 中国語入力（Pinyin）
- 韓国語入力（Hangul）
- その他のIME

### 2. モバイルデバイスでの動作

- iOS Safari
- Android Chrome
- 仮想キーボードとの相互作用

## テスト方法

### 1. 基本テスト

1. セルをダブルクリックして編集開始
2. 日本語を入力（例：「こんにちは」）
3. スペースキーで変換
4. Enterキーで確定
5. セル編集が継続されることを確認

### 2. 複雑なテスト

1. 複数回の変換を含む入力
2. 変換候補の選択
3. 変換のキャンセル
4. 部分確定

### 3. ブラウザ横断テスト

- Chrome
- Firefox
- Safari
- Edge

## 履歴

- 2025-01-26: 初回作成
- 問題: セル編集中に日本語の確定でセルが確定してしまう
- 解決: IME状態の適切な追跡とキーイベント処理の改善
## 実装
の詳細

### 修正されたコード

#### 1. 状態管理の拡張 (core.js)

```javascript
// IME composition state tracking
isComposing: false,
imeJustEnded: false,
```

#### 2. キーイベントハンドリングの改善 (cell-editor.js)

```javascript
// Enter key behavior (README spec)
if (event.key === 'Enter' && !event.shiftKey) {
    // IME入力中、または直後の場合は処理をスキップ（日本語入力の確定を区別）
    if (state.isComposing || state.imeJustEnded) {
        console.log('CellEditor: Enter pressed during/after IME composition, ignoring');
        return;
    }
    
    event.preventDefault();
    event.stopPropagation();
    // ... セル確定処理
}
```

#### 3. IMEイベントハンドリングの強化

```javascript
input.addEventListener('compositionend', (e) => {
    console.log('CellEditor: IME composition ended:', e.data);
    state.isComposing = false;
    
    // IME確定直後のEnterキーイベントを適切に処理するため、
    // 短時間だけフラグを設定
    state.imeJustEnded = true;
    setTimeout(() => {
        state.imeJustEnded = false;
    }, 50); // 50ms後にフラグをクリア
});
```

### 開発環境でのテスト方法

1. `dev/index.html` を開く
2. Simple Tableを読み込む
3. セルをダブルクリックして編集開始
4. 日本語を入力してテスト：
   - 「こんにちは」と入力
   - スペースキーで変換
   - Enterキーで確定
   - セル編集が継続されることを確認
5. 実際のセル確定をテスト：
   - 再度Enterキーを押してセル確定
   - 次の行に移動することを確認

### トラブルシューティング

#### 問題: IME確定後もセルが確定してしまう

**原因**: `imeJustEnded` フラグのタイムアウト時間が短すぎる

**解決**: タイムアウト時間を調整（50ms → 100ms）

```javascript
setTimeout(() => {
    state.imeJustEnded = false;
}, 100); // 100msに延長
```

#### 問題: 通常のEnterキーが効かない

**原因**: `imeJustEnded` フラグがクリアされていない

**解決**: 状態のリセット処理を確認

```javascript
// セル確定・キャンセル時に必ずフラグをクリア
state.isComposing = false;
state.imeJustEnded = false;
```

### パフォーマンス考慮事項

- IMEイベントは頻繁に発生するため、ログ出力は本番環境では削除を検討
- `setTimeout` の使用は最小限に抑制
- 状態フラグの管理は軽量に保つ

### 今後の改善点

1. **ブラウザ互換性の向上**
   - Safari での IME 動作テスト
   - Firefox での動作確認

2. **モバイル対応**
   - タッチデバイスでの IME 処理
   - 仮想キーボードとの連携

3. **他言語対応**
   - 中国語入力（Pinyin）
   - 韓国語入力（Hangul）
   - その他のIME

4. **ユーザビリティ向上**
   - IME状態の視覚的フィードバック
   - 入力モードの表示