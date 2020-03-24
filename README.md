# Coronavirus Charts
A project for creating COVID-19 charts

## Steps include

1. clone this repo
1. $ cd coronavirus
1. $ npm i
1. export a CSV file into ./data from one of the sheets here: https://docs.google.com/spreadsheets/d/1SdoIq11jOk-bZ6qabyy942JaE7O6LE7mMgog27bBZFI/edit#gid=1938031650 (or a sheet with the exact same structure; additional data columns allowed)
1. edit the file name in ./tools/build.js to point to the exported file
1. $ make
1. copy output beginning with 'grid' and ending with '..'
1. create a new L116 item
1. refresh browser window
