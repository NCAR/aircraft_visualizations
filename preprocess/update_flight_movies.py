import os
import psycopg2
import argparse
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

DB_CONFIG = {
    'host': os.getenv('PG_HOST', 'eol-rosetta.eol.ucar.edu'),
    'dbname': os.getenv('PG_DATABASE', 'aircraft_data'),
    'user': os.getenv('PG_USER', 'ads'),
    'password': os.getenv('PG_PASSWORD'),
}

def main():
    parser = argparse.ArgumentParser(description="Update flights table with movie filenames.")
    parser.add_argument("--project", required=True, help="Project name (case insensitive)")
    parser.add_argument("--movie_dir", required=True, help="Directory containing movie files")
    args = parser.parse_args()

    project_name = args.project.lower()
    movie_dir = args.movie_dir

    # Get all movie files in the directory
    movie_files = [f for f in os.listdir(movie_dir) if os.path.isfile(os.path.join(movie_dir, f))]

    with psycopg2.connect(**DB_CONFIG) as conn:
        with conn.cursor() as cursor:
            # Find project_id (case insensitive)
            cursor.execute("SELECT id FROM projects WHERE LOWER(project_name) = %s", (project_name,))
            result = cursor.fetchone()
            if not result:
                print(f"Project '{args.project}' not found.")
                return
            project_id = result[0]
            print(f"Project ID for '{args.project}': {project_id}")

            # Get all flights for this project
            cursor.execute("SELECT id, flight_number FROM flights WHERE project_id = %s", (project_id,))
            flights = cursor.fetchall()
            flight_map = {str(flight_number).lower(): flight_id for flight_id, flight_number in flights}

            # Try to match movie files to flight_number
            updated = 0
            for filename in movie_files:
                # Extract flight number from filename (customize this if needed)
                # Example: RF01_movie.mp4 -> rf01
                base = os.path.splitext(filename)[0]
                # Find rfXX pattern
                import re
                match = re.search(r'(rf\d+)', base, re.IGNORECASE)
                if match:
                    flight_number = match.group(1).lower()
                    if flight_number in flight_map:
                        flight_id = flight_map[flight_number]
                        full_path = os.path.abspath(os.path.join(movie_dir, filename))
                        cursor.execute("UPDATE flights SET movie_filename = %s WHERE id = %s", (full_path, flight_id))
                        updated += 1
                        print(f"Updated flight {flight_number} with movie {full_path}")
            conn.commit()
            print(f"Updated {updated} flights with movie filenames.")

if __name__ == "__main__":
    main()  
