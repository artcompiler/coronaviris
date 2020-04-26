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

const FILE_IN = './data/isciii-spain.csv';
const FILE_OUT = './build/data/isciii-spain.json';

const REGION_NAMES = {
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
  'RI': 'La Rioja',
};

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
  const regionLabel = 'CCAA';
  const dateLabel = 'FECHA';
  const casesLabel = 'CASOS';
  const deathsLabel = 'Fallecidos';
  const data = [];
  const regions = {};
  loadData(FILE_IN, (err, rawData) => {
    rawData.forEach((row, i) => {
      const regionName = REGION_NAMES[row[regionLabel]];
      const groupName = "Spain";
      const fullName = groupName + ", " + regionName;
      let region = regions[fullName];
      if (!region) {
        region = regions[fullName] = {};
        region.regionName = regionName;
        region.groupName = groupName;
        region.caseValues = {};
        region.deathValues = {};
      }
      const dateParts = row[dateLabel].split('/');
      const date = dateParts.length === 3 && new Date(dateParts[2], dateParts[1] - 1, dateParts[0]).toISOString().slice(0, 10) || null;
      const casesCount = casesCountLast = row[casesLabel];
      const deathsCount = deathsCountLast = row[deathsLabel];
      if (date) {
        region.caseValues[date] = casesCount;
        region.deathValues[date] = deathsCount;
      }
    });
    Object.keys(regions).forEach(fullName => {
      const region = regions[fullName];
      data.push({
        dataSource: ['https://covid19.isciii.es/resources/serie_historica_acumulados.csv'],
        regionName: region.regionName,
        groupName: region.groupName,
        cases: region.caseValues,
        deaths: region.deathValues,
      });
    });
    fs.writeFile(FILE_OUT, JSON.stringify(data, null, 2), () => {
      console.log(data.length + ' regions in Spain written to ' + FILE_OUT);
    });
  });
}

convert();

