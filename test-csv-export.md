# CSV Export Test

This file is for testing the CSV export functionality and status bar improvements.

| Name | Age | City | Notes |
|------|-----|------|-------|
| Alice | 25 | Tokyo | Software Engineer<br/>Loves coding |
| Bob | 30 | Osaka | Designer<br/>Creative person |
| Carol | 28 | Kyoto | Manager<br/>Team leader |
| David | 35 | Nagoya | Sales Rep<br/>Experienced |

## Test Cases

1. **CSV Export**: Click the "📄 Export CSV" button to test export functionality
2. **Copy/Paste**: Select cells and use Ctrl+C/V to test clipboard operations
3. **Status Display**: Observe status messages in the center of the status bar
4. **Layout Stability**: Verify that status bar height remains constant

## Expected Results

- CSV export should work without "Invalid message format" error
- Status messages should appear in the center of the status bar
- Auto-saved indicator should remain in the left corner
- Table info should remain in the right corner
- Status bar height should not change when messages appear/disappear 