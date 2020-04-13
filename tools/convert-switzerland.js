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
const NEW = true;

const DEATHS_CHART_ID = "4LJhbQ57mSw";
const CASES_CHART_ID = "1MNSpQ7RXHN";
const RECOVERED_CHART_ID = "";

const DATA_FILE = './data/Cases-Table 1.csv';

  const REGION_NAMES = {
  'AG': 'Aargau',
  'AI': 'Appenzell Innerrhoden',
  'AR': 'Appenzell Ausserrhoden',
  'BE': 'Bern',
  'BL': 'Basel-Landschaft',
  'BS': 'Basel-Stadt',
  'FR': 'Fribourg',
  'GE': 'Geneva',
  'GL': 'Glarus',
  'GR': 'Graubünden; Grisons',
  'Ju': 'Jura',
  'LU': 'Luzern',
  'NE': 'Neuchâtel',
  'NW': 'Nidwalden',
  'OW': 'Obwalden',
  'SG': 'St. Gallen',
  'SH': 'Schaffhausen',
  'SO': 'Solothurn',
  'TG': 'Thurgau',
  'TI': 'Ticino',
  'UR': 'Uri',
  'VD': 'Vaud',
  'VS': 'Valais',
  'ZG': 'Zug',
  'ZH': 'Zürich',
  'CH': 'Switzerland',
}; 

function convert() {
  const regionLabel = "";
  const dateLabel = 'Date';
  const groupName = 'Switzerland';
  //const casesLabel = dateLabel;
  //const deathsLabel = 'Fallecidos';
  const casesTable = {}; //deathsTable = {};
  fs.createReadStream(DATA_FILE)
    .pipe(csv())
    .on('data', (row) => {
      console.log(JSON.stringify(row, null, 2));
      let keys = Object.keys(row);
      let date = row[dateLabel];
      keys.forEach(regionName => {
        //console.log(key + ' = ' + row[key]);
        if (regionName === 'Date') {
          return;
        };
        if (!casesTable[regionName]) {
          casesTable[regionName] = {
            regionName: regionName,
            groupName: groupName,
            values : {},
          };

          /*casesTable[key].regionName = key;
          casesTable[key].groupName = 'Switzerland'; */
        } 
        casesTable[regionName].values[date] = +row[regionName] || 0;

      })
      console.log(JSON.stringify(casesTable, null, 2));
      
      //const dateParts = row[dateLabel].split('/');
      //const date = dateParts.length === 3 && new Date(dateParts[0], dateParts[1] - 1, dateParts[2]).toISOString().slice(0, 10) || null;
      /*const casesCount = row[casesTable.values];
      casesTable.values = +casesCount || 0;*/
      //deathsTable[region].values[date] = +deathsCount || 0;
      if (date === null) {
        delete casesTable[region];
        //delete deathsTable[region];
      }
    })
    .on('end', () => {
      const casesData = [],  deathsData = [];
      //console.log(JSON.stringify(casesTable, null, 2));
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
