import psycopg2
import psycopg2.extras
import os
import re
import xarray as xr
import pandas as pd
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

DB_CONFIG = {
    'host': os.getenv('PG_HOST', 'eol-rosetta.eol.ucar.edu'),
    'dbname': os.getenv('PG_DATABASE', 'aircraft_data'),
    'user': os.getenv('PG_USER', 'ads'),
    'password': os.getenv('PG_PASSWORD'),
}

def clean_sql_name(name):
    """Converts a NetCDF variable name to a safe SQL column name."""
    return re.sub(r'[^a-zA-Z0-9_]', '', name).lower()

def get_variable_categories(nc_file):
    """
    Inspects a NetCDF file and categorizes variables.
    """
    timeseries_vars = []
    distribution_vars = []
    bin_vars = set()

    # Identify potential bin definition variables first
    for name, var in nc_file.variables.items():
        if var.ndim == 1 and name in nc_file.dimensions and name != 'Time':
            bin_vars.add(name)

    # Categorize all variables
    for name, var in nc_file.variables.items():
        if name in ['Time', 'time'] or name.endswith('_bnds'):
            continue # Skip time and bounds variables
        
        if var.ndim == 1 and ('Time' in var.dimensions or 'time' in var.dimensions):
            timeseries_vars.append(name)
        elif var.ndim > 1 and ('Time' in var.dimensions or 'time' in var.dimensions):
            # Check if one of its dimensions is a known bin variable
            if any(dim in bin_vars for dim in var.dimensions):
                distribution_vars.append(name)
    
    return sorted(list(timeseries_vars)), sorted(list(distribution_vars)), sorted(list(bin_vars))

def generate_create_table_sql(sample_file):
    """
    Generates the CREATE TABLE SQL statement for the timeseries_data table
    by inspecting a sample NetCDF file.
    """
    print("--- Generating CREATE TABLE SQL ---")
    ds = xr.open_dataset(sample_file)
    timeseries_vars, _, _ = get_variable_categories_xarray(ds)
    
    sql = "CREATE TABLE IF NOT EXISTS timeseries_data (\n"
    sql += "    flight_id INTEGER REFERENCES flights(id) ON DELETE CASCADE,\n"
    sql += "    time TIMESTAMPTZ NOT NULL,\n"
    
    for var_name in timeseries_vars:
        col_name = clean_sql_name(var_name)
        # You could add more sophisticated type mapping here if needed
        sql += f"    {col_name} REAL,\n"
    
    #last comma removal and add final paranthesis and semicolon
    sql = sql.rstrip(',\n') + "\n);\n"
    
     
    print("SQL generation complete. You can run this in your PSQL client.")
    return sql

def setup_database_schema(db_connection):
    """
    Creates all necessary tables for the database.
    """
    # Note: The timeseries_data table should be created using the
    # output from generate_create_table_sql(). This function creates the others.
    
    base_tables_sql = """
    CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        project_name VARCHAR(255) UNIQUE NOT NULL,
        aircraft VARCHAR(100),
        description TEXT,
        year INTEGER,
        data_access VARCHAR(500),
        status VARCHAR(100)
    );

    CREATE TABLE IF NOT EXISTS flights (
        id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        flight_number VARCHAR(50) NOT NULL,
        flight_date DATE,
        UNIQUE (project_id, flight_number)
    );
    
    CREATE TABLE IF NOT EXISTS instrument_bins (
        id SERIAL PRIMARY KEY,
        instrument_name VARCHAR(255) UNIQUE NOT NULL,
        bin_values REAL[]
    );
    CREATE TABLE IF NOT EXISTS variable_metadata (
        id SERIAL PRIMARY KEY,
        variable_name VARCHAR(255) UNIQUE NOT NULL,
        clean_name VARCHAR(255) NOT NULL,
        long_name TEXT,
        units VARCHAR(100),
        description TEXT,
        category VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS variable_projects (
        variable_id INTEGER REFERENCES variable_metadata(id) ON DELETE CASCADE,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        PRIMARY KEY (variable_id, project_id)
    );
    
    CREATE TABLE IF NOT EXISTS size_distribution_data (
        flight_id INTEGER NOT NULL,
        time TIMESTAMPTZ NOT NULL,
        instrument_bin_id INTEGER REFERENCES instrument_bins(id) ON DELETE CASCADE,
        concentration_values REAL[],
        PRIMARY KEY (flight_id, time, instrument_bin_id),
        FOREIGN KEY (flight_id, time) REFERENCES timeseries_data(flight_id, time) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS size_dist_time_idx ON size_distribution_data (flight_id, time);
    CREATE INDEX IF NOT EXISTS var_metadata_clean_name_idx ON variable_metadata (clean_name);
    """
    
    with db_connection.cursor() as cursor:
        print("Creating projects, flights, instrument_bins, and size_distribution_data tables...")
        cursor.execute(base_tables_sql)
    db_connection.commit()
    print("Base tables created successfully.")
def get_variable_categories_xarray(ds):
    """
    Inspects an xarray Dataset and categorizes variables.
    """
    timeseries_vars = []
    distribution_vars = []
    bin_vars = set()

    # Identify potential bin definition variables first
    for name, var in ds.data_vars.items():
        if var.ndim == 1 and name in ds.dims and name != 'Time':
            bin_vars.add(name)

    # Categorize all variables
    for name, var in ds.data_vars.items():
        if name in ['Time', 'time'] or name.endswith('_bnds'):
            continue # Skip time and bounds variables
        
        if var.ndim == 1 and ('Time' in var.dims or 'time' in var.dims):
            timeseries_vars.append(name)
        elif var.ndim > 1 and ('Time' in var.dims or 'time' in var.dims):
            # Check if one of its dimensions is a known bin variable
            if any(dim in bin_vars for dim in var.dims):
                distribution_vars.append(name)
    
    return sorted(list(timeseries_vars)), sorted(list(distribution_vars)), sorted(list(bin_vars))
def extract_variable_metadata(ds, variable_names):
    """
    Extract metadata (long_name, units) for variables from xarray dataset.
    """
    metadata_list = []
    
    for var_name in variable_names:
        if var_name in ds.data_vars:
            var = ds[var_name]
            # Extract attributes
            long_name = var.attrs.get('long_name', '')
            units = var.attrs.get('units', '')
            description = var.attrs.get('description', '')
            category = var.attrs.get('Category', '')
            metadata_list.append({
                'variable_name': var_name,
                'clean_name': clean_sql_name(var_name),
                'long_name': long_name,
                'units': units,
                'description': description,
                'category': category
            })
    
    return metadata_list

def upsert_variable_metadata(cursor, metadata_list):
    """
    Insert or update variable metadata in the database.
    """
    if not metadata_list:
        return
    
    # Use ON CONFLICT to update existing records or insert new ones
    upsert_query = """
        INSERT INTO variable_metadata (variable_name, clean_name, long_name, units, description, category)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (variable_name) 
        DO UPDATE SET 
            clean_name = EXCLUDED.clean_name,
            long_name = EXCLUDED.long_name,
            units = EXCLUDED.units,
            description = EXCLUDED.description,
            category = EXCLUDED.category
    """
    records = [
        (
            meta['variable_name'],
            meta['clean_name'],
            meta['long_name'],
            meta['units'],
            meta['description'],
            meta['category']
        )
        for meta in metadata_list
    ]
    psycopg2.extras.execute_batch(cursor, upsert_query, records)
    print(f"Upserted metadata for {len(records)} variables.")
def ingest_netcdf_file(file_path, db_connection):
    def ensure_timeseries_columns(cursor, table_name, variable_names):
        # Get existing columns in the table
        cursor.execute(f"SELECT column_name FROM information_schema.columns WHERE table_name = %s", (table_name,))
        existing_cols = set(row[0] for row in cursor.fetchall())
        # Exclude always-present columns
        skip_cols = {'flight_id', 'time'}
        # Add missing columns
        for var in variable_names:
            col_name = clean_sql_name(var)
            if col_name not in existing_cols and col_name not in skip_cols:
                print(f"Adding missing column: {col_name}")
                cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {col_name} REAL;")

    """
    Reads a NetCDF file and dynamically inserts all its data into the PostgreSQL database.
    """
    print(f"\n--- Starting ingestion for {os.path.basename(file_path)} ---")
    try:
        # Open with xarray for both data and attributes
        ds = xr.open_dataset(file_path, decode_times=True)
        
        # --- 1. Get Variable Categories (using xarray dataset) ---
        timeseries_vars, distribution_vars, bin_vars = get_variable_categories_xarray(ds)

        with db_connection.cursor() as cursor:
                        # Ensure all timeseries variables have columns in the table
            ensure_timeseries_columns(cursor, 'timeseries_data', timeseries_vars)
            # --- 2. Get or create Project and Flight IDs ---
            filename = os.path.basename(file_path)
            # Get attributes using xarray
            flight_number = ds.attrs.get('FlightNumber', None)
            if flight_number:
                print(flight_number)
            # Parse metadata from xarray attributes
            project_name = ds.attrs.get('project', filename.split('_')[0] if '_' in filename else filename.split('.')[0])
            if not flight_number:
                # Extract flight number from filename if not in attributes
                import re
                match = re.search(r'([rt]f\d+)', filename, re.IGNORECASE)
                flight_number = match.group(1) if match else filename.split('.')[0]
            flight_date = ds.attrs.get('FlightDate', None)
            aircraft = ds.attrs.get('platform', None)
            if aircraft is None:
                aircraft = ds.attrs.get('Platform', None)

            cursor.execute("INSERT INTO projects (project_name, aircraft) VALUES (%s, %s) ON CONFLICT (project_name) DO NOTHING RETURNING id;", (project_name, aircraft))
            result = cursor.fetchone()
            if result:
                project_id = result[0]
            else:
                cursor.execute("SELECT id FROM projects WHERE project_name = %s;", (project_name,))
                project_id = cursor.fetchone()[0]

            cursor.execute(
                "INSERT INTO flights (project_id, flight_number, flight_date) VALUES (%s, %s, %s) ON CONFLICT (project_id, flight_number) DO NOTHING RETURNING id;",
                (project_id, flight_number, flight_date)
            )
            result = cursor.fetchone()
            if result:
                flight_id = result[0]
            else:
                cursor.execute("SELECT id FROM flights WHERE project_id = %s AND flight_number = %s;", (project_id, flight_number,))
                flight_id = cursor.fetchone()[0]
            print(f"Project: {project_name} (ID: {project_id}), Flight: {flight_number} (ID: {flight_id})")

            # Now extract and upsert variable metadata
            print("Extracting variable metadata...")
            all_vars = timeseries_vars + distribution_vars + list(bin_vars)
            metadata_list = extract_variable_metadata(ds, all_vars)
            upsert_variable_metadata(cursor, metadata_list)
            # Associate each variable with the project in variable_projects
            for meta in metadata_list:
                cursor.execute("SELECT id FROM variable_metadata WHERE variable_name = %s", (meta['variable_name'],))
                var_id = cursor.fetchone()[0]
                cursor.execute("""
                    INSERT INTO variable_projects (variable_id, project_id)
                    VALUES (%s, %s)
                    ON CONFLICT DO NOTHING
                """, (var_id, project_id))

            # --- 3. Ingest Bin Definitions ---
            print(f"Found {len(bin_vars)} bin definitions. Upserting into 'instrument_bins'...")
            for bin_name in bin_vars:
                bin_data = ds[bin_name].values.tolist()
                cursor.execute(
                    "INSERT INTO instrument_bins (instrument_name, bin_values) VALUES (%s, %s) ON CONFLICT (instrument_name) DO NOTHING;",
                    (bin_name, bin_data)
                )
            
            # --- 4. Ingest Time-Series Data ---
            print(f"Preparing to insert {len(timeseries_vars)} time-series variables...")
            
            # Get timestamps as Python datetime objects (decode_times=True handles this)
            timestamps = pd.to_datetime(ds['Time'].values).to_pydatetime()
            
            # Dynamically build the insert statement
            cols = [clean_sql_name(v) for v in timeseries_vars]
            sql_insert_ts = f"INSERT INTO timeseries_data (flight_id, time, {', '.join(cols)}) VALUES %s ON CONFLICT DO NOTHING"
            
            # Fetch all data into memory using xarray
            ts_data_arrays = [ds[v].values for v in timeseries_vars]
            
            # Create records for batch insertion
            records_to_insert = []
            for i in range(len(timestamps)):
                row_data = [flight_id, timestamps[i]]
                for j in range(len(timeseries_vars)):
                    # Handle numpy data types for psycopg2
                    val = ts_data_arrays[j][i]
                    row_data.append(None if pd.isna(val) else float(val))
                records_to_insert.append(tuple(row_data))
            
            # Batch insert
            psycopg2.extras.execute_values(cursor, sql_insert_ts, records_to_insert)
            print(f"Inserted {len(records_to_insert)} rows into 'timeseries_data'.")

            # --- 5. Ingest Size Distribution Data ---
            print(f"Preparing to insert {len(distribution_vars)} size distribution variables...")
            # Get all bin IDs from the database at once
            cursor.execute("SELECT id, instrument_name FROM instrument_bins")
            bin_id_map = {name: id for id, name in cursor.fetchall()}

            dist_records_to_insert = []
            for dist_var_name in distribution_vars:
                # Use xarray to get variable dimensions and data
                var_dims = ds[dist_var_name].dims
                bin_dim_name = next((dim for dim in var_dims if dim in bin_vars), None)
                if not bin_dim_name: continue
                
                instrument_bin_id = bin_id_map.get(bin_dim_name)
                if not instrument_bin_id: continue

                # Use xarray to get the data
                data_cube = ds[dist_var_name].values
                for i in range(len(timestamps)):
                    concentration_values = data_cube[i].flatten().tolist()
                    dist_records_to_insert.append((flight_id, timestamps[i], instrument_bin_id, concentration_values))

            if dist_records_to_insert:
                sql_insert_dist = "INSERT INTO size_distribution_data (flight_id, time, instrument_bin_id, concentration_values) VALUES %s ON CONFLICT DO NOTHING"
                psycopg2.extras.execute_values(cursor, sql_insert_dist, dist_records_to_insert)
                print(f"Inserted {len(dist_records_to_insert)} records into 'size_distribution_data'.")

        db_connection.commit()
        print(f"Successfully committed all data for {filename}")

    except Exception as e:
        db_connection.rollback()
        print(f"ERROR: Failed to ingest {file_path}. Transaction rolled back. Reason: {e}")
        import traceback
        traceback.print_exc()

# --- Main Execution ---
if __name__ == '__main__':
    # This script can be run in two modes:
    # 1. 'generate-sql': To print the CREATE TABLE statement for the timeseries_data table.
    # 2. 'ingest': To run the full ingestion process.

    import sys
    if len(sys.argv) < 3:
        print("Usage:")
        print("  python ingest_data.py generate-sql /path/to/one/sample.nc")
        print("  python ingest_data.py ingest /path/to/your/netcdf/files")
        sys.exit(1)

    mode = sys.argv[1]
    path = sys.argv[2]

    if mode == 'generate-sql':
        if not os.path.isfile(path):
            print(f"Error: Sample file not found at {path}")
            sys.exit(1)
        create_sql = generate_create_table_sql(path)
        with open("create_timeseries_table.sql", "w") as f:
            f.write(create_sql)
        print("\nSQL written to 'create_timeseries_table.sql'.")
        print("Please run this SQL in your database BEFORE running the ingestion.")

    elif mode == 'ingest':
        if not os.path.isdir(path):
            print(f"Error: Directory not found at {path}")
            sys.exit(1)
            
        with psycopg2.connect(**DB_CONFIG) as conn:
            # First, ensure the base tables exist
            setup_database_schema(conn)

            # Now, process all the files
            for filename in sorted(os.listdir(path)):
                if filename.endswith((".nc", ".cdf", ".netcdf")):
                    file_path = os.path.join(path, filename)
                    ingest_netcdf_file(file_path, conn)
    else:
        print(f"Error: Unknown mode '{mode}'. Choose 'generate-sql' or 'ingest'.")