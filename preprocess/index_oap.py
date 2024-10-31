import os
import json

rdat = os.getenv('RAW_DATA_DIR')
def save_directory_contents_to_json(directory_path, output_file):
    directory_contents = {}
    
    for root, dirs, files in os.walk(directory_path):
        for dir_name in dirs:
            print(dir_name)
            if dir_name == 'hourly_tar':
                continue
            dir_path = os.path.join(root, dir_name)
            directory_contents[dir_name] = []
            for sub_root, sub_dirs, sub_files in os.walk(dir_path):
                for file_name in sub_files:
                    if file_name.endswith('.png'):
                        directory_contents[dir_name].append(file_name)
    
    with open(output_file, 'w') as json_file:
        json.dump(directory_contents, json_file, indent=4)

# Example usage
save_directory_contents_to_json(f'{rdat}/CAESAR/OAP_Imagery/F2DS', 'CAESAR_F2DS.json')
save_directory_contents_to_json(f'{rdat}/CAESAR/OAP_Imagery/HVPS', 'CAESAR_HVPS.json')