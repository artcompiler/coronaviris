# coronaviris
A project for creating COVID-19 charts

## Steps include

1. clone this repo
2. $ npm i
3. export a CSV file into ./data from one of the sheets here: https://docs.google.com/spreadsheets/d/1SdoIq11jOk-bZ6qabyy942JaE7O6LE7mMgog27bBZFI/edit#gid=1938031650
4. edit the file name in ./tools/build.js to point to the exported file
5. $ make
6. copy output beginning with 'grid' and ending with '..'
7. create a new L116 item
8. refresh browser window
