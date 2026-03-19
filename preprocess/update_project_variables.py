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

def main():
    parser = argparse.ArgumentParser(description="Associate variables with a project in variable_metadata.")
    parser.add_argument('--project', required=True, help='Project name (case insensitive)')
    parser.add_argument('--variables', required=True, nargs='+', help='List of variable names to associate')
    args = parser.parse_args()

    project_name = args.project.lower()
    variables = args.variables

    with psycopg2.connect(**DB_CONFIG) as conn:
        with conn.cursor() as cursor:
            # Get project_id
            cursor.execute("SELECT id FROM projects WHERE LOWER(project_name) = %s", (project_name,))
            result = cursor.fetchone()
            if not result:
                print(f"Project '{args.project}' not found.")
                return
            project_id = result[0]
            print(f"Project ID for '{args.project}': {project_id}")

            # Associate variables with project using variable_projects table
            updated = 0
            for var in variables:
                cursor.execute("SELECT id FROM variable_metadata WHERE variable_name = %s", (var,))
                var_result = cursor.fetchone()
                if var_result:
                    var_id = var_result[0]
                    cursor.execute("""
                        INSERT INTO variable_projects (variable_id, project_id)
                        VALUES (%s, %s)
                        ON CONFLICT DO NOTHING
                    """, (var_id, project_id))
                    print(f"Associated variable '{var}' with project '{args.project}'")
                    updated += 1
                else:
                    print(f"Variable '{var}' not found in variable_metadata.")
            conn.commit()
            print(f"Updated {updated} variables.")

if __name__ == "__main__":
    main()
