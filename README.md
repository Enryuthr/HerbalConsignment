# Herbal Consignment Tracker

Small local web app for tracking herbal products consigned to pharmacies.

## What It Does

- Saves product master data once.
- Saves pharmacy master data once.
- Records product deliveries to pharmacies.
- Records pharmacy sales reports.
- Records payments received from pharmacies.
- Shows dashboard totals, stock reports, balance reports, JSON backup, JSON import, and CSV exports.

## How To Open

Open `index.html` in a browser.

No server, install step, account, or internet connection is needed.

## How Data Is Stored

All data is saved in the browser using `localStorage` under the key:

```text
herbal_consignment_v1
```

This means data stays on the same browser and same device.

## Backup

Use the **Backup** tab.

- **Export Backup as JSON** downloads all products, pharmacies, deliveries, sales, and payments.
- **Import Backup from JSON** restores data from a previous backup file.

Make regular backups before clearing browser data, changing devices, or reinstalling the browser.

## localStorage Limitations

- Data is only on one device and one browser.
- Clearing browser data can delete the records.
- It is not good for multiple users editing at the same time.
- Storage size is limited compared with a real database.

## Future Upgrade Idea

For version 2, move storage to Supabase or Firebase so data can sync across devices, support login, and be safer for daily business use.
