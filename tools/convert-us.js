// TODO
// -- compute daily values from totals
// --
const https = require('https');
const http = require('http');
const csv = require('csv-parser');
const fs = require('fs');

function rmdir(path) {
  try { var files = fs.readdirSync(path); }
  catch(e) { return; }
  if (files.length > 0) {
    for (var i = 0; i < files.length; i++) {
      var filePath = path + '/' + files[i];
      if (fs.statSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
      } else {
	rmdir(filePath);
      }
    }
  }
  fs.rmdirSync(path);
}

function mkdir(path) {
  fs.mkdirSync(path);
}

function cldir(path) {
  rmdir(path);
  mkdir(path);
}

function exec(cmd, args) {
  console.log("exec() cmd=" + cmd);
  execSync(cmd, args);
}

function clean() {
  console.log("Cleaning...");
  cldir('./build');
  mkdir('./build/data');
}

function build() {
  clean();
  convert();
}

const DATE_RANGE = 29;

const DEATHS_TYPE = "Deaths";
const CASES_TYPE = "Cases";

const US_REGION = "US";
const UK_REGION = "UK";
const REGION = US_REGION;

const TYPE = CASES_TYPE;  // SET ME TO CHANGE CHARTS!
const NEW = false;

const DEATHS_CHART_ID = "4LJhbQ57mSw";
const CASES_CHART_ID = "1MNSpQ7RXHN";
const RECOVERED_CHART_ID = "";

const CASES_FILE_IN = './data/covid_confirmed_usafacts.csv';
const DEATHS_FILE_IN = './data/covid_deaths_usafacts.csv';
const CASES_FILE_OUT = 'build/data/us-cases.json';
const DEATHS_FILE_OUT = 'build/data/us-deaths.json';

function convert(inFile, outFile) {
  const regionLabel = 'County Name';
  const groupLabel = 'State';
  const data = [];
  fs.createReadStream(inFile)
    .pipe(csv())
    .on('data', (row) => {
      const groupName = row["State"];
      const regionName = row["County Name"];
      const values = {};
      const keys = Object.keys(row);
      const dates = keys.slice(keys.length - 29);
      dates.forEach((d, i) => {
        const dateParts = d.split('/');
        const date = dateParts.length === 3 && new Date('20' + dateParts[2], dateParts[0] - 1, dateParts[1]).toISOString().slice(0, 10) || null;
        values[date] = +row[d];
      });
      data.push({
        regionName: regionName,
        groupName: groupName,
        values: values,
      });
    })
    .on('end', () => {
      fs.writeFile(outFile, JSON.stringify(data, null, 2), () => {
        console.log(data.length + ' regions in US, written to ' + outFile);
      });
    });
}

convert(CASES_FILE_IN, CASES_FILE_OUT);
convert(DEATHS_FILE_IN, DEATHS_FILE_OUT);

