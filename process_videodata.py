import pandas as pd

input_file = 'data/videodata.csv'
output_file = 'data/videodata_processed.csv'

print(f"Loading {input_file}...")
try:
    df = pd.read_csv(input_file)
    print(f"Original shape: {df.shape}")

    # Remove rows where sku is blank
    if 'sku' in df.columns:
        df = df[df['sku'].notna()]
        df = df[df['sku'].str.strip() != '']
    
    # Drop all the requested columns
    cols_to_drop = ['use_type', 'media_position', 'is_exclude', 'media_embed', 'media_label', 'media_type', 'advancedmedia_id', 'product_id']
    existing_cols_to_drop = [col for col in cols_to_drop if col in df.columns]
    df = df.drop(columns=existing_cols_to_drop)

    # Prepend URL to media_src
    if 'media_src' in df.columns:
        base_url = "https://cdn2.gempundit.com/skin/video/"
        df['media_src'] = base_url + df['media_src'].astype(str)

    # Put 'sku' as the first column
    if 'sku' in df.columns:
        # Get list of other columns
        other_cols = [col for col in df.columns if col != 'sku']
        # Reorder with 'sku' first
        df = df[['sku'] + other_cols]

    # Save to CSV
    df.to_csv(output_file, index=False)
    print(f"Successfully processed data and saved to {output_file}")
    print(f"Final shape: {df.shape}")
    print(df.head())

except Exception as e:
    print(f"An error occurred: {e}")
