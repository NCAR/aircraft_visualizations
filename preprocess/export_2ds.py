#!/usr/bin/env python3

import struct
from bitarray import bitarray
import argparse
import os
import pandas as pd
datadir = os.getenv('DATA_DIR')
rawdata = os.getenv('RAW_DATA_DIR')
class P2dRec:
    """Class to represent a single 4KB record with metadata."""
    HEADER_FORMAT = '>8hH'  # Big-endian: 9 int16 fields + 1 uint16 field (9h + 1H)
    HEADER_SIZE = 20 # Size of the header in bytes (20 bytes)

    VALID_IDS = {
        "C1", "C2", "P1", "P2",  # Traditional 32 diode PMS2D
        "C4", "C5", "C6", "P4",  # Fast 2DC and 2DP
        "C8", "P8",              # DMT CIP and PIP
        "G1", "G2",              # Greyscale
        "H1", "H2",              # HVPS
        "3H", "3V",              # SPEC 3V-CPI
        "SH", "SV"               # SPEC 2DS
    }

    def __init__(self, record_data):
        """
        Initialize the P2dRec object by parsing the record header and data.
        :param record_data: A 4,116-byte record.
        """
        self.id = None
        self.hour = None
        self.minute = None
        self.second = None
        self.year = None
        self.month = None
        self.day = None
        self.tas = None
        self.msec = None
        self.overld = None
        self.binary_data = None
        self.valid_id = False

        self._parse_record(record_data)

    def _parse_record(self, record_data):
        """
        Parse the record header and binary data.
        :param record_data: A 4,116-byte record.
        """
        if len(record_data) < self.HEADER_SIZE:
            raise ValueError(f"Record data is too small: {len(record_data)} bytes")
        # Parse the first 2 bytes as ASCII ID
        self.id = record_data[:2].decode('ascii')
        # Validate the ASCII ID
        self.valid_id = self.id in self.VALID_IDS
        # Parse header fields

        if not self.valid_id:
            print(f"Warning: Invalid ID field {self.id} encountered.")

        # Parse the remaining header fields
        header = struct.unpack(self.HEADER_FORMAT, record_data[2:self.HEADER_SIZE])
        (self.hour, self.minute, self.second,
         self.year, self.month, self.day,
         self.tas, self.msec, self.overld) = header

        # Parse binary data (remaining part of the record)
        self.binary_data = ''.join(format(byte, '08b') for byte in record_data[self.HEADER_SIZE:])
    def __str__(self):
        """
        String representation for debugging.
        """
        header_info = (f"ID: {self.id}, "
                       f"Time: {self.hour}:{self.minute}:{self.second}, "
                       f"Date: {self.year}-{self.month}-{self.day}, TAS: {self.tas}, "
                       f"Milliseconds: {self.msec}, Overload: {self.overld}")
        binary_preview = f"Binary Data (first 64 bits): {self.binary_data[:64]}..."
        return f"{header_info}\n{binary_preview}"
def read_oap_file(filename):
    """Read and decode an OAP file."""
    with open(filename, 'rb') as file:
        # Read the entire file content
        file_content = file.read()

        # Find the end of the XML header (the closing tag `</OAP>`)
        xml_end_index = file_content.find(b'</OAP>') + len(b'</OAP>')+1

        if xml_end_index == 0:
            print("No XML header found.")
            return

        # Skip the XML header
        binary_data = file_content[xml_end_index:]

        # Read and decode each 4116-byte record
        records = []
        record_size = 4096 + 20  # Header (20 bytes) + Data (4096 bytes)
        for i in range(0, len(binary_data), record_size):
            record_data = binary_data[i:i + record_size]
            if len(record_data) < record_size:
                print(f"Skipping incomplete record at index {i}.")
                continue
            record = P2dRec(record_data)
            records.append(record)
            #print(record)

        return records
    


# Convert the list of P2dRec objects to a pandas DataFrame


def main():
    # Parse command-line arguments
    parser = argparse.ArgumentParser(description='Output 2d files as csv.')
    parser.add_argument('project', type=str, help='Project name to output the data to.')
    args = parser.parse_args()
    ##glob list of files based on project name in /scr/raf_data/{project}
    
    
    # Merge the datasets
    for file in os.listdir(rawdata+'/'+args.project+'/PMS2D'):
        if file.endswith('.2d'):
            print('Processing file:', file)
            records = read_oap_file(f"{rawdata}/{args.project}/PMS2D/{file}")
            outfile = datadir+'/'+args.project+'/2DS_csv/'+file.replace('.2d', '.csv')
            
            records_df = pd.DataFrame([{
                'ID': record.id,
                'Time': f"{record.hour:02}:{record.minute:02}:{record.second:02}.{record.msec:03}",
                'Date': f"{record.year:04}-{record.month:02}-{record.day:02}",
                'Airspeed': record.tas,
                'Overload': record.overld,
                'BinaryData': record.binary_data
            } for record in records])

        # Save the DataFrame to a CSV file
        records_df.to_csv(outfile, index=False)
        print('CSV file saved:', outfile)

if __name__ == '__main__':
    main()