import pandas as pd
import requests
from io import StringIO
import base64

import os

# URLs for the CSV files
sku_url = "https://staging.gempundit.com/var/export/skubyidexport.csv"
value_url = "https://staging.gempundit.com/var/export/q3.csv"

# Basic Auth header from environment variables
username = os.environ.get('GEMPUNDIT_REPORT_USERNAME', '')
password = os.environ.get('GEMPUNDIT_REPORT_PASSWORD', '')

if not username or not password:
    print("Warning: GEMPUNDIT_REPORT_USERNAME or GEMPUNDIT_REPORT_PASSWORD not set in environment.")

auth_str = f"{username}:{password}"
auth_b64 = base64.b64encode(auth_str.encode()).decode()
headers = {
    'Authorization': f'Basic {auth_b64}', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
}

def download_csv(url, headers):
    print(f"Downloading from {url}...")
    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        return pd.read_csv(StringIO(response.text))
    else:
        print(f"Failed to download. Status code: {response.status_code}")
        return None

# Download SKU file
sku_df = download_csv(sku_url, headers)
if sku_df is not None:
    print("SKU DataFrame loaded successfully:")
    print(sku_df.head())
else:
    print("Failed to load SKU DataFrame. Exiting.")
    exit()

# Download Values file
value_df = download_csv(value_url, headers)
if value_df is not None:
    try:
        # Ensure required columns exist
        required_columns = ['entity_id', 'value', 'value_id', 'attribute_id']
        if not all(col in value_df.columns for col in required_columns):
            raise KeyError(f"One or more required columns missing: {required_columns}")

        # Prepend base URL to 'value' column
        base_url = "https://imgcdn1.gempundit.com/media/catalog/product"
        value_df['value'] = base_url + value_df['value'].astype(str)

        # Drop unnecessary columns
        value_df = value_df.drop(columns=['value_id', 'attribute_id'])

        # Merge with SKU DataFrame
        if 'entity_id' in sku_df.columns:
            merged_df = pd.merge(value_df, sku_df[['entity_id', 'sku']], on='entity_id', how='left')
        else:
            raise KeyError("Column 'entity_id' not found in SKU DataFrame")

        # Remove rows with blank 'sku'
        merged_df = merged_df[merged_df['sku'].notna()]

        # Group by 'sku' and concatenate 'value' data
        grouped = merged_df.groupby('sku')['value'].apply(lambda x: ','.join(x)).reset_index()

        # Split concatenated 'value' data into separate columns
        split_values = grouped['value'].str.split(',', expand=True)
        split_values.columns = [f'value_{i+1}' for i in range(split_values.shape[1])]

        # Concatenate 'sku' column and split value columns
        final_df = pd.concat([grouped['sku'], split_values], axis=1)
        
        # Save to CSV
        output_file = 'data/q3_processed_images.csv'
        final_df.to_csv(output_file, index=False)
        print(f"\nSuccessfully processed data and saved to {output_file}")
        print(final_df.head())
        
    except Exception as e:
        print(f"An error occurred during processing: {e}")
else:
    print("Failed to load Values DataFrame. Exiting.")
