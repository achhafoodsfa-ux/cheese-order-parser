# Supplied Stock Sheet Format Notes

Source workbook: `/home/ubuntu/upload/StockSheetFinalFormate.xlsx`

The workbook contains five worksheets: `Sheet2` (89 rows × 10 columns), `OrderSheet` (221 rows × 108 columns), `Sheet1` (86 rows × 2 columns), `Price List` (154 rows × 8 columns), and `Allocation` (209 rows × 13 columns).

`OrderSheet` is the main operational stock format. It is a wide order-summary sheet with category headers, product descriptions, SAP codes, units, carton ratios, and branch/order rows. Its product columns include `Pizza Cheddar`, `Pizza Cheddar 1kg`, `Achha Shred White`, `UK Shred`, `Local 70/30`, and many other cheese products. The SAP-code row begins with items such as `FG-02-0006`, `FG-02-0005`, `FG-02-0018`, and `FG-03-0018`.

`Sheet2` is a smaller customer/order document layout with columns for Item Code, Item Description, Quantity, Unit Price, Tax Code, Total, Warehouse, and COGS. It contains the same SAP product-code universe.

Implementation direction: preserve the supplied workbook as the output template; match parsed FG codes to the `OrderSheet` SAP-code row; aggregate physical PKT quantities per branch; write branch/customer/order identifiers and product quantities into new or selected order rows without overwriting source formulas or product headers.
