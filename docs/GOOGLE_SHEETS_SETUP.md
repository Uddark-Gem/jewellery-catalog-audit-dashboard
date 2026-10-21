# Google Sheets Integration Guide

This guide details how to connect your existing Google Service Account JSON credentials file to the **Jewellery Catalog Audit Dashboard** without using Supabase, Firebase, or external database providers.

---

## 1. Prerequisites

- A Google Service Account JSON credentials file (e.g. `google-service-account.json`).
- A target Google Spreadsheet created in Google Drive.
- Editor permission granted to your service account email on that spreadsheet.

---

## 2. Step-by-Step Setup

### Step 1: Place Your Service Account JSON File
Copy your service account JSON file into the `./secrets/` directory in the project root:

```bash
# Path should be:
./secrets/google-service-account.json
```

> **Security Note:** The `secrets/*.json` pattern is explicitly included in `.gitignore`. Your private keys will never be tracked or committed to GitHub.

### Step 2: Extract Your Service Account Client Email
Open your `google-service-account.json` file and locate the `"client_email"` field:

```json
{
  "type": "service_account",
  "project_id": "your-gcp-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "catalog-audit-sa@your-gcp-project.iam.gserviceaccount.com",
  ...
}
```

Copy the `client_email` address.

### Step 3: Share Your Google Spreadsheet
1. Open your target Google Spreadsheet in your web browser.
2. Click the **Share** button in the top-right corner.
3. Paste the service account's `client_email` into the "Add people and groups" field.
4. Select the role: **Editor**.
5. Uncheck "Notify people" and click **Share**.

### Step 4: Configure Your Environment Variables
Create or open your `.env.local` file in the project root and add:

```env
# Path to your credentials JSON file
GOOGLE_SERVICE_ACCOUNT_JSON_PATH=./secrets/google-service-account.json

# Extract the spreadsheet ID from your browser URL:
# https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit
GOOGLE_SPREADSHEET_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms

# Worksheet tab name for main products (default: Products)
GOOGLE_SHEET_NAME=Products

# (Optional) Google Drive Folder ID for backup uploads
GOOGLE_DRIVE_FOLDER_ID=your_drive_folder_id_here
```

### Step 5: (Alternative) Serverless / Cloud Hosting (e.g., Vercel, Render)
If deploying to a hosting platform where local disk files cannot be mounted, you can encode your JSON file as a Base64 string and pass it as an environment variable:

```bash
# In PowerShell:
[Convert]::ToBase64String([IO.File]::ReadAllBytes("./secrets/google-service-account.json"))
```

Then in your cloud dashboard set:
```env
GOOGLE_SERVICE_ACCOUNT_BASE64=<your_base64_string>
GOOGLE_SPREADSHEET_ID=your_spreadsheet_id
```

---

## 3. Verifying the Connection

1. Start the server:
   ```bash
   npm run start:all
   ```
2. In the server console output, you should see:
   ```
   ========================================================
    Jewellery Catalog Audit Dashboard Server
    Running on: http://localhost:3000
    Environment: development
   ========================================================
    [Google Sheets] Connected: "My Jewellery Catalog"
    [Google Sheets] Service Account: catalog-audit-sa@...
    [Google Sheets] Available Sheets: Products, gemstone2_wise, hsn metal gemstone...
   ```
3. In the web dashboard header, click the **Sheets: Connected** pill to open the Google Sheets management modal.
4. Click **Test Read Latency** to execute a live test against your spreadsheet.

---

## 4. Google Sheets Quota & Best Practices

- Google Sheets API has a usage limit of **300 read requests per minute** and **300 write requests per minute** per project.
- The dashboard automatically uses batch reads (`batchGet`) and batch updates (`batchUpdate`) to minimize API round-trips.
- The built-in retry layer implements exponential backoff to handle transient 429 quota errors safely.
- Reference sheets are cached locally in memory and in `data/audit-databases-cache.json` for 10 minutes to prevent unnecessary API consumption.
