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

const DATA_FILE = './data/covid_spain.csv';

function convert() {
  const regionLabel = 'CCAA Codigo ISO';
  const dateLabel = 'Fecha';
  const casesLabel = 'Casos ';
  const deathsLabel = 'Fallecidos';
  const casesTable = {}, deathsTable = {};
  fs.createReadStream(DATA_FILE)
    .pipe(csv())
    .on('data', (row) => {
      const region = row[regionLabel];
      if (!casesTable[region]) {
        casesTable[region] = {
          regionName: region,
          groupName: "ESP",
        };
      }
      if (!deathsTable[region]) {
        deathsTable[region] = {
          regionName: region,
          groupName: "ESP",
        };
      }
      const dateParts = row[dateLabel].split('/');
      const date = dateParts.length === 3 && new Date(dateParts[2], dateParts[1], dateParts[0]).toISOString().slice(0, 10) || null;
      const casesCount = row[casesLabel];
      const deathsCount = row[deathsLabel];
      casesTable[region][date] = +casesCount || 0;
      deathsTable[region][date] = +deathsCount || 0;
      if (date === null) {
        delete casesTable[region];
        delete deathsTable[region];
      }
    })
    .on('end', () => {
      const casesData = [], deathsData = [];
      Object.keys(casesTable).forEach(key => {
        casesData.push(casesTable[key]);
        deathsData.push(deathsTable[key]);
      });
      fs.writeFile('build/data/spain-cases.json', JSON.stringify(casesData, null, 2), () => {
        console.log('Done writing file spain-cases.json');
      });
      fs.writeFile('build/data/spain-deaths.json', JSON.stringify(deathsData, null, 2), () => {
        console.log('Done writing file spain-deaths.json');
      });
      console.log('CSV file successfully processed');
    });
}

convert();

