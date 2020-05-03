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

const DEATHS_TYPE = "Deaths";
const CASES_TYPE = "Cases";

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
  const regionLabel = 'location';
  const dateLabel = 'date';
  const casesLabel = 'cases';
  const deathsLabel = 'deaths';
  const data = [];
  const regions = {};
  loadData(FILE_IN, (err, rawData) => {
    rawData.forEach((row, i) => {
      const regionName = "United States";
      const groupName = "America";
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
        dataSource: ['https://github.com/nytimes/covid-19-data/blob/master/us.csv'],
        regionName: region.regionName,
        groupName: region.groupName,
        cases: region.caseValues,
        deaths: region.deathValues,
      });
    });
    fs.writeFile(FILE_OUT, JSON.stringify(data, null, 2), () => {
      console.log(data.length + ' regions in NYT US, written to ' + FILE_OUT);
    });
  });
}

convert();

