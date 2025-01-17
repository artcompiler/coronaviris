//Convert Switzerland

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
}

function build() {
  convert();
}

const DATE_RANGE = 29;

const DEATHS_TYPE = "Deaths";
const CASES_TYPE = "Cases";

/*
const US_REGION = "US";
const UK_REGION = "UK";
const REGION = US_REGION;
*/
const TYPE = CASES_TYPE;  // SET ME TO CHANGE CHARTS!
const NEW = false;

const DEATHS_CHART_ID = "4LJhbQ57mSw";
const CASES_CHART_ID = "1MNSpQ7RXHN";
const RECOVERED_CHART_ID = "";

const DATA_FILE = './data/switzerland-cases.csv';

/* const REGION_NAMES = {
  'AN': 'Andalucía',
  'AR': 'Aragón',
  'AS': 'Asturias, Principado de',
  'IB': 'Balears',
  'CN': 'Canarias',
  'CB': 'Cantabria',
  'CM': 'Castilla-La Mancha',
  'CL': 'Castilla y León',
  'CT': 'Catalunya',
  'CE': 'Ceuta',
  'VC': 'Valenciana, Comunidad',
  'EX': 'Extremadura',
  'GA': 'Galicia',
  'MD': 'Madrid, Comunidad de',
  'ME': 'ME',
  'MC': 'Murcia, Región de',
  'NC': 'Navarra, Comunidad Foral de',
  'PV': 'País Vasco',
  'RI': 'RI',
}; */

function convert() {
  const regionLabel = 'Region';
  const dateLabel = 'Date du cas';
  const casesLabel = 'Cas confirmé';
  //const deathsLabel = 'Fallecidos';
  const casesTable = {}; //deathsTable = {};
  fs.createReadStream(DATA_FILE)
    .pipe(csv())
    .on('data', (row) => {
      console.log("convert() row=" + JSON.stringify(row, null, 2));
      const region = row[regionLabel];
      if (!casesTable[region]) {
        casesTable[region] = {
          regionName: region,
          groupName: "EU",
          values: {},
        };
      }
      /*if (!deathsTable[region]) {
        deathsTable[region] = {
          regionName: region,
          groupName: "EU",
          values: {},
        };
      }*/
      const dateParts = row[dateLabel].split('/');
      const date = dateParts.length === 3 && new Date(dateParts[2], dateParts[0] - 1, dateParts[1]).toISOString().slice(0, 10) || null;
      const casesCount = row[casesLabel];
      //const deathsCount = row[deathsLabel]; 
      casesTable[region].values[date] = +casesCount || 0;
      //deathsTable[region].values[date] = +deathsCount || 0;
      if (date === null) {
        delete casesTable[region];
        //delete deathsTable[region];
      }
    })
    .on('end', () => {
      const casesData = [],  deathsData = [];
      Object.keys(casesTable).forEach(key => {
        casesData.push(casesTable[key]);
        //deathsData.push(deathsTable[key]);
      });
      fs.writeFile('build/data/switzerland-cases.json', JSON.stringify(casesData, null, 2), () => {
        console.log(casesData.length + ' regions in Switzerland, written to build/data/switzerland-cases.json');
      });
      /*fs.writeFile('build/data/switzerland-cases.json', JSON.stringify(deathsData, null, 2), () => {
        console.log(deathsData.length + ' regions in Switzerland, written to build/data/switzerland-deaths.json');
      });*/
    });
}

build();
