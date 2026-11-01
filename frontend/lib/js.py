import os

directory = input("Enter directory path: ")

found = False

for file in os.listdir(directory):
    if file.endswith(".txt"):
        print("Text file:", file)
        found = True

if not found:
    print("No .txt files found in this directory.")