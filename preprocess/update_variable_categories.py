import os
import sys
import psycopg2
import xarray as xr
import argparse
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

DB_CONFIG = {
    'host': os.getenv('PG_HOST', 'eol-rosetta.eol.ucar.edu'),
    'dbname': os.getenv('PG_DATABASE', 'aircraft_data'),
    'user': os.getenv('PG_USER', 'ads'),
    'password': os.getenv('PG_PASSWORD'),
}

def update_categories_from_netcdf(nc_path, conn):
    ds = xr.open_dataset(nc_path)
    for var_name in ds.data_vars:
        var = ds[var_name]
        # Try both 'Category' and 'category' (case-insensitive)
        category = var.attrs.get('Category') or var.attrs.get('category') or ''
        if category:
            with conn.cursor() as cursor:
                cursor.execute(
                    "UPDATE variable_metadata SET category = %s WHERE variable_name = %s",
                    (category, var_name)
                )
                print(f"Updated {var_name} with category '{category}' from {os.path.basename(nc_path)}")
    ds.close()

def main():
    parser = argparse.ArgumentParser(description="Update variable_metadata categories from NetCDF files.")
    parser.add_argument('nc_file', help='NetCDF file to process')
    args = parser.parse_args()

    nc_file = args.nc_file
    with psycopg2.connect(**DB_CONFIG) as conn:
        try:
            update_categories_from_netcdf(nc_file, conn)
        except Exception as e:
            print(f"Error processing {nc_file}: {e}")
        conn.commit()
        print("Category update complete.")

if __name__ == "__main__":
    main()
