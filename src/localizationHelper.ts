// このモジュールは拡張機能側メッセージのローカライズ解決を補助する。
// 担当: vscode.l10n.t() がキーを返した場合に、l10n バンドルを直接読み込んで確実に翻訳文字列へフォールバックする。
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

type LocalizationBundle = Record<string, string>;

export class LocalizationHelper {
    private readonly defaultBundle: LocalizationBundle;
    private readonly languageBundle: LocalizationBundle;

    constructor(extensionPath: string) {
        this.defaultBundle = this.loadBundle(extensionPath, 'bundle.l10n.json');
        this.languageBundle = this.loadLanguageBundle(extensionPath, vscode.env.language);
    }

    public t(key: string, ...args: Array<string | number>): string {
        const resolvedByVsCode = vscode.l10n.t(key, ...args);
        if (resolvedByVsCode !== key) {
            return resolvedByVsCode;
        }

        const template = this.languageBundle[key] ?? this.defaultBundle[key];
        if (typeof template !== 'string') {
            return key;
        }

        return template.replace(/\{(\d+)\}/g, (_match, indexText: string) => {
            const index = Number(indexText);
            const value = args[index];
            return value === undefined ? `{${index}}` : String(value);
        });
    }

    private loadLanguageBundle(extensionPath: string, language: string): LocalizationBundle {
        const normalizedLanguage = language.toLowerCase();
        const languageBase = normalizedLanguage.split('-')[0];
        const candidates = [
            `bundle.l10n.${normalizedLanguage}.json`,
            `bundle.l10n.${languageBase}.json`
        ];

        for (const candidate of candidates) {
            const bundle = this.loadBundle(extensionPath, candidate);
            if (Object.keys(bundle).length > 0) {
                return bundle;
            }
        }

        return {};
    }

    private loadBundle(extensionPath: string, fileName: string): LocalizationBundle {
        const filePath = path.join(extensionPath, 'l10n', fileName);

        try {
            if (!fs.existsSync(filePath)) {
                return {};
            }

            const raw = fs.readFileSync(filePath, 'utf8');
            const parsed = JSON.parse(raw) as LocalizationBundle;
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch {
            return {};
        }
    }
}