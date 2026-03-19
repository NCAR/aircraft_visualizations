import psycopg2
import argparse
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

DB_CONFIG = {
    'host': os.getenv('PG_HOST', 'eol-rosetta.eol.ucar.edu'),
    'dbname': os.getenv('PG_DATABASE', 'aircraft_data'),
    'user': os.getenv('PG_USER', 'ads'),
    'password': os.getenv('PG_PASSWORD'),
}


def remove_project(project_name, dry_run=False):
    with psycopg2.connect(**DB_CONFIG) as conn:
        with conn.cursor() as cursor:
            # Find the project
            cursor.execute(
                "SELECT id, project_name FROM projects WHERE LOWER(project_name) = LOWER(%s)",
                (project_name,)
            )
            result = cursor.fetchone()
            if not result:
                print(f"Project '{project_name}' not found in database.")
                return
            project_id, db_project_name = result
            print(f"Found project: '{db_project_name}' (ID: {project_id})")

            # Show what will be deleted
            cursor.execute(
                "SELECT id, flight_number, flight_date FROM flights WHERE project_id = %s ORDER BY flight_number",
                (project_id,)
            )
            flights = cursor.fetchall()
            print(f"\nFlights to remove ({len(flights)}):")
            for fid, fnum, fdate in flights:
                cursor.execute(
                    "SELECT COUNT(*) FROM timeseries_data WHERE flight_id = %s",
                    (fid,)
                )
                row_count = cursor.fetchone()[0]
                print(f"  flight_id={fid}, {fnum}, {fdate}, {row_count} timeseries rows")

            # Find variables that ONLY belong to this project (will be orphaned)
            cursor.execute("""
                SELECT vm.id, vm.variable_name, vm.clean_name
                FROM variable_metadata vm
                JOIN variable_projects vp ON vm.id = vp.variable_id
                WHERE vp.project_id = %s
                  AND vm.id NOT IN (
                      SELECT variable_id FROM variable_projects WHERE project_id != %s
                  )
                ORDER BY vm.variable_name
            """, (project_id, project_id))
            orphaned_vars = cursor.fetchall()

            # Find variables shared with other projects (will keep metadata)
            cursor.execute("""
                SELECT vm.variable_name
                FROM variable_metadata vm
                JOIN variable_projects vp ON vm.id = vp.variable_id
                WHERE vp.project_id = %s
                  AND vm.id IN (
                      SELECT variable_id FROM variable_projects WHERE project_id != %s
                  )
                ORDER BY vm.variable_name
            """, (project_id, project_id))
            shared_vars = cursor.fetchall()

            print(f"\nVariables ONLY in '{db_project_name}' (will be removed from variable_metadata): {len(orphaned_vars)}")
            for vid, vname, cname in orphaned_vars:
                print(f"  {vname} (clean: {cname})")

            print(f"\nVariables shared with other projects (metadata kept): {len(shared_vars)}")
            for (vname,) in shared_vars:
                print(f"  {vname}")

            if dry_run:
                print("\n[DRY RUN] No changes made.")
                return

            # Delete the project — CASCADE handles flights, timeseries_data,
            # size_distribution_data, and variable_projects
            print(f"\nDeleting project '{db_project_name}' and all cascaded data...")
            cursor.execute("DELETE FROM projects WHERE id = %s", (project_id,))
            print(f"  Project and all associated flights/data deleted.")

            # Remove orphaned variable_metadata entries
            if orphaned_vars:
                orphaned_ids = [v[0] for v in orphaned_vars]
                cursor.execute(
                    "DELETE FROM variable_metadata WHERE id = ANY(%s)",
                    (orphaned_ids,)
                )
                print(f"  Removed {len(orphaned_ids)} orphaned variable_metadata entries.")

            # Check for instrument_bins that are no longer referenced
            cursor.execute("""
                SELECT ib.id, ib.instrument_name
                FROM instrument_bins ib
                WHERE NOT EXISTS (
                    SELECT 1 FROM size_distribution_data sd WHERE sd.instrument_bin_id = ib.id
                )
            """)
            orphaned_bins = cursor.fetchall()
            if orphaned_bins:
                print(f"\n  Orphaned instrument_bins found ({len(orphaned_bins)}):")
                for bid, bname in orphaned_bins:
                    print(f"    {bname} (id={bid})")
                bin_ids = [b[0] for b in orphaned_bins]
                cursor.execute("DELETE FROM instrument_bins WHERE id = ANY(%s)", (bin_ids,))
                print(f"  Removed {len(bin_ids)} orphaned instrument_bins.")

        conn.commit()
        print(f"\nDone. All '{db_project_name}' data has been removed.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Remove a project and all associated data from the aircraft database."
    )
    parser.add_argument("project", help="Project name to remove (case insensitive)")
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Show what would be deleted without making changes"
    )
    args = parser.parse_args()
    remove_project(args.project, dry_run=args.dry_run)
