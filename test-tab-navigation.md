# Tab Navigation Test

Test table for Tab navigation after text input:

| Name | Age | City |
|------|-----|------|
| Alice | 25 | Tokyo |
| Bob | 30 | Osaka |
| Carol | 28 | Kyoto |

## Test Instructions

1. Click on the "Alice" cell to edit it
2. Change the text to "Alice Smith"
3. Press Tab key
4. Verify that the next cell (Age: 25) shows blue selection border

5. Click on the "Tokyo" cell to edit it  
6. Change the text to "Tokyo, Japan"
7. Press Tab key
8. Verify that the next cell (Bob) shows blue selection border

The fix should ensure that after entering text in edit mode, pressing Tab will show the blue border around the next cell.
