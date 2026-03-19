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

UPDATABLE_FIELDS = ['aircraft', 'description', 'year', 'data_access', 'status']


def update_project(project_name, updates):
    with psycopg2.connect(**DB_CONFIG) as conn:
        with conn.cursor() as cursor:
            # Find the project
            cursor.execute(
                "SELECT id, project_name, aircraft, description, year, data_access, status "
                "FROM projects WHERE LOWER(project_name) = LOWER(%s)",
                (project_name,)
            )
            result = cursor.fetchone()
            if not result:
                print(f"Project '{project_name}' not found in database.")
                return

            project_id = result[0]
            current = {
                'project_name': result[1],
                'aircraft': result[2],
                'description': result[3],
                'year': result[4],
                'data_access': result[5],
                'status': result[6],
            }

            print(f"Found project: '{current['project_name']}' (ID: {project_id})")
            print(f"  Current values:")
            for field in UPDATABLE_FIELDS:
                print(f"    {field}: {current[field]}")

            if not updates:
                print("\nNo updates specified.")
                return

            # Build and execute the UPDATE
            set_clauses = []
            values = []
            for field, value in updates.items():
                set_clauses.append(f"{field} = %s")
                values.append(value)
            values.append(project_id)

            sql = f"UPDATE projects SET {', '.join(set_clauses)} WHERE id = %s"
            cursor.execute(sql, values)
            conn.commit()

            print(f"\nUpdated {len(updates)} field(s):")
            for field, value in updates.items():
                print(f"  {field}: {current[field]} -> {value}")


def main():
    parser = argparse.ArgumentParser(
        description="Update fields on a project in the projects table.",
        epilog="Example: python update_project.py GOTHAAM --aircraft C130 --status 'In Progress' --year 2025"
    )
    parser.add_argument('project', help='Project name (case insensitive)')
    parser.add_argument('--aircraft', help='Aircraft name')
    parser.add_argument('--description', help='Project description')
    parser.add_argument('--year', type=int, help='Project year')
    parser.add_argument('--data_access', help='Data access URL or info')
    parser.add_argument('--status', help='Project status')
    args = parser.parse_args()

    updates = {}
    for field in UPDATABLE_FIELDS:
        value = getattr(args, field)
        if value is not None:
            updates[field] = value

    if not updates:
        print("No update flags provided. Use --aircraft, --description, --year, --data_access, or --status.")
        parser.print_help()
        return

    update_project(args.project, updates)


if __name__ == "__main__":
    main()
