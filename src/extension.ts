import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('Markdown Table Editor extension is now active!');

    // Register commands
    const openEditorCommand = vscode.commands.registerCommand('markdownTableEditor.openEditor', () => {
        vscode.window.showInformationMessage('Table Editor will open here!');
    });

    const createTableCommand = vscode.commands.registerCommand('markdownTableEditor.createTable', () => {
        vscode.window.showInformationMessage('New table will be created here!');
    });

    context.subscriptions.push(openEditorCommand, createTableCommand);
}

export function deactivate() {
    console.log('Markdown Table Editor extension is now deactivated!');
}