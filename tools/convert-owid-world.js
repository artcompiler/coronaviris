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

const FILE_IN = './data/owid-world.csv';
const FILE_OUT = './build/data/owid-world.json';

function loadData(filename, resume) {
  const data = [];
  fs.createReadStream(filename)
    .pipe(csv())
    .on('data', (row) => {
      data.push(row);
    })
    .on('end', () => {
      resume([], data);
    });
}

function convert() {
  const groupName = "World";
  const regionLabel = 'location';
  const dateLabel = 'date';
  const casesLabel = 'total_cases';
  const deathsLabel = 'total_deaths';
  const data = [];
  const regions = {};
  loadData(FILE_IN, (err, rawData) => {
    rawData.forEach((row, i) => {
      const regionName = row[regionLabel];
      const fullName = groupName + ", " + regionName;
      let region = regions[fullName];
      if (!region) {
        region = regions[fullName] = {};
        region.regionName = regionName;
        region.groupName = groupName;
        region.caseValues = {};
        region.deathValues = {};
      }
      const dateParts = row[dateLabel].split('-');
      const date = dateParts.length === 3 && new Date(dateParts[0], dateParts[1] - 1, dateParts[2]).toISOString().slice(0, 10) || null;
      const casesCount = +row[casesLabel] || 0;
      const deathsCount = +row[deathsLabel] || 0;
      if (date) {
        region.caseValues[date] = casesCount;
        region.deathValues[date] = deathsCount;
      }
    });
    Object.keys(regions).forEach(fullName => {
      const region = regions[fullName];
      data.push({
        dataSource: ['https://covid.ourworldindata.org/data/owid-covid-data.csv'],
        regionName: region.regionName,
        groupName: region.groupName,
        cases: region.caseValues,
        deaths: region.deathValues,
      });
    });
    fs.writeFile(FILE_OUT, JSON.stringify(data, null, 2), () => {
      console.log(data.length + ' regions in the world, written to ' + FILE_OUT);
    });
  });
}

convert();

