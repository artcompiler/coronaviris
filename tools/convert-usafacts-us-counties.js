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

const DATE_RANGE = 31;

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

const CASES_FILE = './data/usafacts-us-counties-cases.csv';
const DEATHS_FILE = './data/usafacts-us-counties-deaths.csv';
const FILE_OUT = 'build/data/usafacts-us-counties.json';

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
  const regionLabel = 'County Name';
  const groupLabel = 'State';
  const data = [];
  const regions = {};
  loadData(CASES_FILE, (err, casesData) => {
    loadData(DEATHS_FILE, (err, deathsData) => {
      casesData.forEach((row, i) => {
        const regionName = row[regionLabel];
        const groupName = row[groupLabel];
        const fullName = groupName + ", " + regionName;
        let region;
        if (!regions[fullName]) {
          region = regions[fullName] = {};
          region.regionName = regionName;
          region.groupName = groupName;
          region.caseValues = {};
          region.deathValues = {};
        }
        const keys = Object.keys(row);
        const dates = keys.slice(keys.length - DATE_RANGE);
        const cases = {}, deaths = {};
        dates.forEach((d, i) => {
          const dateParts = d.split('/');
          const year = dateParts[2];
          const date = dateParts.length === 3 && new Date(year.length === 2 && '20' + year || year, dateParts[0] - 1, dateParts[1]).toISOString().slice(0, 10) || null;
          if (date) {
            region.caseValues[date] = +row[d];
          }
        });
      });
      deathsData.forEach((row, i) => {
        const regionName = row[regionLabel];
        const groupName = row[groupLabel];
        const fullName = groupName + ", " + regionName;
        let region = regions[fullName];
        if (!regions[fullName]) {
          region = regions[fullName] = {};
          region.regionName = regionName;
          region.groupName = groupName;
          region.caseValues = {};
          region.deathValues = {};
        }
        const keys = Object.keys(row);
        const dates = keys.slice(keys.length - DATE_RANGE);
        const cases = {}, deaths = {};
        dates.forEach((d, i) => {
          const dateParts = d.split('/');
          const year = dateParts[2];
          
          const date = dateParts.length === 3 && new Date(year.length === 2 && '20' + year || year, dateParts[0] - 1, dateParts[1]).toISOString().slice(0, 10) || null;
          region.deathValues[date] = +row[d];
        });
      });
      Object.keys(regions).forEach(fullName => {
        const region = regions[fullName];
        data.push({
          dataSource: ['https://usafacts.org/visualizations/coronavirus-covid-19-spread-map/'],
          regionName: region.regionName,
          groupName: region.groupName,
          cases: region.caseValues,
          deaths: region.deathValues,
        });
      });
      fs.writeFile(FILE_OUT, JSON.stringify(data, null, 2), () => {
        console.log(data.length + ' regions in US, written to ' + FILE_OUT);
      });
    });
  });
  // fs.createReadStream(inFile)
  //   .pipe(csv())
  //   .on('data', (row) => {
  //     const groupName = row["State"];
  //     const regionName = row["County Name"];
  //     const values = {};
  //     const keys = Object.keys(row);
  //     const dates = keys.slice(keys.length - DATE_RANGE);
  //     dates.forEach((d, i) => {
  //       const dateParts = d.split('/');
  //       const year = dateParts[2];
  //       const date = dateParts.length === 3 && new Date(year.length === 2 && '20' + year || year, dateParts[0] - 1, dateParts[1]).toISOString().slice(0, 10) || null;
  //       values[date] = +row[d];
  //     });
  //     data.push({
  //       regionName: regionName,
  //       groupName: groupName,
  //       cases: cases,
  //       deaths: deaths,
  //     });
  //   })
  //   .on('end', () => {
  //     fs.writeFile(outFile, JSON.stringify(data, null, 2), () => {
  //       console.log(data.length + ' regions in US, written to ' + outFile);
  //     });
  //   });
}

convert();

