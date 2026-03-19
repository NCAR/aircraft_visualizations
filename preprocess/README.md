# preprocess utilities

Utilities in this folder support loading and maintaining aircraft data in PostgreSQL,
plus a small set of OAP-related helper scripts.

## current files

| File | Purpose |
| --- | --- |
| `.env.example` | Example database environment variables used by scripts that connect with `psycopg2`. |
| `environment.yml` | Conda environment definition for preprocess dependencies. |
| `ingest_data.py` | Main ingestion utility. Creates base tables, ingests NetCDF time-series and size-distribution data, and upserts variable metadata/project associations. |
| `remove_project.py` | Removes a project and cascaded flight/data rows; can run as `--dry-run` first. |
| `update_project.py` | Updates project fields (`aircraft`, `description`, `year`, `data_access`, `status`). |
| `update_project_variables.py` | Associates existing variables from `variable_metadata` to a project in `variable_projects`. |
| `update_variable_categories.py` | Updates `variable_metadata.category` from variable attributes in a NetCDF file. |
| `update_flight_movies.py` | Matches movie filenames to flights (via `rf##` pattern) and updates `flights.movie_filename`. |
| `export_2ds.py` | Converts PMS2D `.2d` binary records to CSV files for a project. |
| `index_oap.py` | One-off directory indexer that writes JSON listings of `.png` files for CAESAR OAP imagery paths. |

## setup

1. Create the environment (or use the existing one on EOL servers):

   `conda env create -f environment.yml`

2. Activate it:

   `conda activate aircraft_db`

3. Copy `.env.example` to `.env` and fill in database credentials if needed.

4. Example direct database connection:

   `psql -h eol-rosetta.eol.ucar.edu -U ads -d aircraft_data`

## ingestion workflow

1. Generate a starter SQL table definition from a representative NetCDF file:

   `python ingest_data.py generate-sql /path/to/sample.nc`

   This writes `create_timeseries_table.sql` in this directory.

2. Apply the generated SQL in PostgreSQL (if `timeseries_data` is not already created):

   `psql -h eol-rosetta.eol.ucar.edu -U ads -d aircraft_data -f create_timeseries_table.sql`

3. Ingest a directory of NetCDF files:

   `python ingest_data.py ingest /path/to/netcdf_directory`

During ingest, the script:

- Ensures base tables exist (`projects`, `flights`, `instrument_bins`, `variable_metadata`, `variable_projects`, `size_distribution_data`).
- Creates missing columns in `timeseries_data` for new time-series variables.
- Upserts variable metadata and project associations.
- Inserts time-series and distribution records.

## project and metadata maintenance

Update project fields:

`python update_project.py GOTHAAM --aircraft C130 --status "In Progress" --year 2025`

Associate variables to a project:

`python update_project_variables.py --project GOTHAAM --variables CONC3D TEMP TASX`

Update variable categories from one NetCDF file:

`python update_variable_categories.py /path/to/file.nc`

Remove a project:

Preview removing a project:
`python remove_project.py GOTHAAM --dry-run`

Remove a project for real:
`python remove_project.py GOTHAAM`

## flight movies

Populate the flight movie filenames from a directory of movie files:

`python update_flight_movies.py --project GOTHAAM --movie_dir /path/to/movies`

Movie names are matched to flights using an `rf##` pattern in filenames.

## oap helpers

Convert `.2d` files to CSV for a project (uses `RAW_DATA_DIR` and `DATA_DIR` environment variables):

`python export_2ds.py <project>`

Build JSON indexes of `.png` files for CAESAR OAP imagery (script currently contains hard-coded paths/output names):

`python index_oap.py`