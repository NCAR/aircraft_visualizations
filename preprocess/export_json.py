#!/usr/bin/env python3

import xarray as xr
import numpy as np
import datetime as dt
import json
import argparse
import os

var_list = ['ATX','WIC','WDC','FO3C_ACOM','DPXC','PSX','CONCD_LWI','WSC','GGALT']
datadir = os.getenv('DATADIR')
prod = '/scr/raf/Prod_Data/'
def export_to_json(filename,project):
    ds= xr.open_dataset(f'{datadir}/{project}/{filename}')
    base = filename.split('.')[0]
    print(base)
    temp = ds[var_list]
    temp['Time'] = temp['Time'].dt.strftime('%Y-%m-%dT%H:%M:%S')
    temp_dict =temp.to_dict()
    with open(f'{datadir}/{project}/LRT_json/{base}.json','w') as f:
        json.dump(temp_dict,f,indent=4)
    print('Saved data to json file')
    track =['GGLAT','GGLON']
    temp = ds[track]
    temp['Time'] = temp['Time'].dt.strftime('%Y-%m-%dT%H:%M:%S')
    temp_dict =temp.to_dict()
    with open(f'{datadir}/{project}/LRT_json/{base}_track.json','w') as f:
        json.dump(temp_dict,f,indent=4)
    print('Saved track to json file')
    

def main():
    # Parse command-line arguments
    parser = argparse.ArgumentParser(description='Export LRT netcdf data to json.')
    parser.add_argument('project', type=str, help='Project name to output the data to.')
    args = parser.parse_args()
    ##glob list of files based on project name in /scr/raf_data/{project}
    
    
    # Merge the datasets
    for file in os.listdir(prod+args.project):
        if 'WVISO'in file:
            continue
        if file.endswith(".nc"):
            if args.project in file:
                export_to_json(file,args.project)
                print(f'exported {file} to json')

if __name__ == '__main__':
    main()