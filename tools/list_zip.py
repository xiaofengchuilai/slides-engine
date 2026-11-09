import zipfile, sys
z = zipfile.ZipFile(sys.argv[1])
names = z.namelist()
print('\n'.join(names))
