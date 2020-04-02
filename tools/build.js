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
  generate();
}

function updateData() {
  exec("curl https://usafactsstatic.blob.core.windows.net/public/data/covid-19/covid_confirmed_usafacts.csv > data/covid_confirmed_usafacts.csv");
  exec("curl https://usafactsstatic.blob.core.windows.net/public/data/covid-19/covid_deaths_usafacts.csv > data/covid_deaths_usafacts.csv");
}

const DEATHS_TYPE = "Deaths";
const CASES_TYPE = "Cases";

const TYPE = DEATHS_TYPE;  // SET ME TO CHANGE CHARTS!

const DEATHS_CHART_ID = "4LJhbQ57mSw";
const CASES_CHART_ID = "1MNSpQ7RXHN";
const RECOVERED_CHART_ID = "";
const DATA_FILE =
      TYPE === DEATHS_TYPE && './data/covid_deaths_usafacts.csv' ||
      TYPE === CASES_TYPE && './data/covid_confirmed_usafacts.csv';
const THRESHOLD =
      TYPE === DEATHS_TYPE && 1 ||
      TYPE === CASES_TYPE && 1;
const CHART_ID =
      TYPE === DEATHS_TYPE && DEATHS_CHART_ID ||
      TYPE === CASES_TYPE && CASES_CHART_ID;

const pingCache = {};
function pingLang(lang, resume) {
  if (pingCache[lang]) {
    resume(true);
  } else {
    const options = {
      method: 'GET',
      host: getAPIHost(lang),
      port: getAPIPort(lang),
      path: '/lang?id=' + lang.slice(1),
    };
    const protocol = LOCAL_COMPILES && http || https;
    const req = protocol.request(options, function(r) {
      const pong = r.statusCode === 200;
      pingCache[lang] = pong;
      resume(pong);
    }).on("error", (e) => {
      console.log("ERROR pingLang() e=" + JSON.stringify(e));
      resume(false);
    }).end();
  }
}

function putComp(secret, data, resume) {
  const encodedData = JSON.stringify(data);
  const options = {
    host: "gc.acx.ac",
    port: "443",
    path: "/comp",
    method: "PUT",
    headers: {
      "Content-Type": "text/plain",
      "Content-Length": Buffer.byteLength(encodedData),
      "Authorization": secret,
    },
  };
  const req = https.request(options);
  req.on("response", (res) => {
    let data = "";
    res.on('data', function (chunk) {
      data += chunk;
    }).on('end', function () {
      if (resume) {
        resume(null, JSON.parse(data));
      }
    }).on("error", function (err) {
      console.log("[13] ERROR " + err);
    });
  });
  req.end(encodedData);
  req.on('error', function(err) {
    console.log("[14] ERROR " + err);
    resume(err);
  });
}

function putCode(secret, data, resume) {
  const encodedData = JSON.stringify(data);
  const options = {
    host: "localhost", //"gc.acx.ac",
    port: "3000", //"443",
    path: "/code",
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(encodedData),
      "Authorization": secret,
    },
  };
  const req = http.request(options);
  req.on("response", (res) => {
    let data = "";
    res.on('data', function (chunk) {
      data += chunk;
    }).on('end', function () {
      if (resume) {
        resume(null, JSON.parse(data));
      }
    }).on("error", function (err) {
      console.log("[13] ERROR " + err);
    });
  });
  req.end(encodedData);
  req.on('error', function(err) {
    console.log("[14] ERROR " + err);
    resume(err);
  });
}

let pending = 0;  // FIXME this only works if there is one batch being scraped.
let scraped = {};
let RETRIES = 4;
const batchScrape = async (scale, force, ids, index, resume) => {
  try {
    index = index || 0;
    if (index < ids.length) {
      let id = ids[index];
      let t0 = new Date;
      pending++;
      if (!scraped[id]) {
        scraped[id] = 0;
      }
      postSnap(id, (err, val) => {
        scraped[id]++;
        pending--;
        if (err) {
          // Try re-scraping three times.
          if (scraped[id] < RETRIES) {
            batchScrape(scale, force, ids, index, resume);
            console.log("ERROR batchScrape retry " + scraped[id] + ", " + (index + 1) + "/" + ids.length + ", " + id);
          } else {
            console.log("ERROR batchScrape skipping " + (index + 1) + "/" + ids.length + ", " + id);
          }
        } else {
          console.log("SNAP " + (index + 1) + "/" + ids.length + ", " + id + " in " + (new Date() - t0) + "ms");
        }
        while (pending < scale && index < ids.length) {
          index = index + 1;
          id = ids[index];
          if (scraped[id] === undefined) {
            batchScrape(scale, force, ids, index, resume);
          }
        }
      });
    } else {
      resume && resume();
    }
  } catch (x) {
    console.log("[7] ERROR " + x.stack);
    resume && resume("ERROR batchScrape");
  }
};

function postSnap(id, resume) {
  let encodedData = JSON.stringify({
    id: id,
    host: "https://gc.acx.ac", // coronavirus.artcompiler.com, c9s.acx.ac
  });
  var options = {
    host: "puppeteer-service.artcompiler.com",
    port: "80",
    path: "/snap",
    method: "POST",
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(encodedData),
    },
  };
  var req = http.request(options);
  req.on("response", (res) => {
    var data = "";
    res.on('data', function (chunk) {
      data += chunk;
    }).on('end', function () {
      if (res.statusCode !== 200) {
        resume(res.statusCode);
      } else {
        resume(null, data);
      }
    }).on("error", function () {
      console.log("error() status=" + res.statusCode + " data=" + data);
      resume(res.statusCode);
    });
  });
  req.end(encodedData);
  req.on('error', function(err) {
    console.log("[12] ERROR " + err);
    resume(err);
  });
}

function generate() {
  let data = [];
  fs.createReadStream(DATA_FILE)
    .pipe(csv())
    .on('data', (row) => {
      const state = row["State"];
      const county = row["County Name"];
      const region = (state && (state + ", ") || "") + county;
      const keys = Object.keys(row);
      const dates = keys.slice(keys.length - 29);
      const objNew = {
        region: state === county && county || region,
        isNew: true,
        values: [
          ["Date", "Count"],
        ],
      };
      const objTotal = {
        region: state === county && county || region,
        isNew: false,
        values: [
          ["Date", "Count"],
        ],
      };
      let lastDate;
      let value;
      dates.forEach((date, i) => {
        objNew.values.push([date, +row[date] - +row[lastDate], +row[date]]);
        objTotal.values.push([date, +row[date]]);
        lastDate = date;
      });
      if (+row[lastDate] >= THRESHOLD) {
        data.push({
          id: CHART_ID,
          data: objNew,
        });
        data.push({
          id: CHART_ID,
          data: objTotal,
        });
      }
    })
    .on('end', () => {
      // fs.writeFile('build/data/daily-deaths.l114.json', JSON.stringify(data, null, 2), () => {
      //   console.log(data.length + ' items found');
      // });
      console.log(data.length + ' items found');
      console.log('CSV file successfully processed');
      compile(data);
    });
}

const SCALE = 4;
const secret = process.env.ARTCOMPILER_CLIENT_SECRET;
let allIDs = [];
function compile(data, resume) {
  // data = [{id, data: {region, values}}]
  console.log("Compiling...");
  let totalCharts = data.length;
  let count = 0;
  let regionTable = {};   // { name, total, subregions, data }
  let regions = [];
  let regionItems = [];
  data.forEach((v) => {
    let [region, subregion] = v.data.region.split(",");
    let values = v.data.values;
    let total = 0;
    regions.push(v.data);
    values.forEach(v => {
      total = !isNaN(+v[1]) && v[1] || 0;
    });
    if (!regionTable[region]) {
      regionTable[region] = {
        region: region,
        total: 0,
        subregions: [],
      };
    }
    regionTable[region].subregions.push({
      id: v.id,
      region: region,
      subregion: subregion,
      isNew: v.data.isNew || false,
      total: total,
      data: {
        region: region,
        values: values,
      },
    });
  });
  Object.keys(regionTable).forEach(region => {
    let data = regionTable[region].subregions;
    data.sort((a, b) => {
      return b.total - a.total;
    });
    let total = 0;
    data.forEach(v => {
      total += v.total;  // Add total for each region.
    });
    regionTable[region].total = total;
    regionItems.push(regionTable[region]);
    putComp(secret, data, (err, valNew) => {
      // Charts compiled.
      const date = new Date();
      const yesterday = new Date();
      yesterday.setDate(date.getDate() - 1);
      let pageSrc = renderRegionPage(valNew, date, yesterday, allIDs);
      putCode(secret, {
        language: "L116",
        src: pageSrc,
      }, async (err, val) => {
        console.log("PUT /comp Region Page: https://gc.acx.ac/form?id=" + val.id);
        regionTable[region].id = val.id;
        if (allIDs.length === totalCharts) {
          // All subregion charts have been compiled. Now render region charts.
          let frontPage = renderFrontPage(regionItems, date, yesterday);
          putCode(secret, {
            language: "L116",
            src: frontPage,
          }, async (err, val) => {
            console.log("PUT /comp Front Page: https://gc.acx.ac/form?id=" + val.id);
            batchScrape(SCALE, false, allIDs, 0, (err, obj) => {
              if (err) {
                console.log("scrape() err=" + JSON.stringify(err));
                reject(err);
              } else {
                console.log("done");
                //console.log(JSON.stringify(regionTable, null, 2));
              }
            });
          });
        }
      });
    });
  });
}

function renderFrontPage(items, now, yesterday) {
  // item = {region, total, id}
  let pageSrc = "";
  pageSrc += "\nlet resize = <x: style { 'width': 250 } x>..\n";
  pageSrc += "grid [\n";
  pageSrc += 'row twelve-columns [br, ';
  pageSrc += 'style { "fontSize": "12"} cspan "Posted: ' + now.toUTCString() + '"';
  pageSrc += '],\n';
  let completed = 0;
  items.sort((a, b) => {
    return b.total - a.total;
  });
  items && items.length && items.forEach((item, i) => {
    console.log("renderFrontPage() item=" + JSON.stringify(item, null, 2));
    let region = item.region;
    pageSrc +=
    'style { "fontSize": "12"} row twelve-columns [br, ' +
      'href "form?id=' + item.id + '" "' + region + '", ' +
      'br, "' + item['total'] + ' Total ' + TYPE + '", br, ' +
      '"' + yesterday.toUTCString().slice(0, 16) + '"' +
      ']\n';
  });
  pageSrc += "].."
  return pageSrc;
}

function renderRegionPage(items, now, yesterday, ids) {
  // item = {region, subregion, total, id, isNew}
  const itemsTable = {};
  const itemsNames = [];
  items.forEach(item => {
    const name = item.subregion + ", " + item.region;
    if (!itemsTable[name]) {
      itemsTable[name] = {};
    }
    if (item.isNew) {
      itemsTable[name]["new"] = item;
    } else {
      itemsNames.push(name);
      itemsTable[name]["total"] = item;
    }
  });
  let pageSrc = "";
  pageSrc += "\nlet resize = <x: style { 'width': 250 } x>..\n";
  pageSrc += "grid [\n";
  pageSrc += 'row twelve-columns [br, ';
  pageSrc += 'style { "fontSize": "12"} cspan "Posted: ' + now.toUTCString() + '"';
  pageSrc += '],\n';
  let completed = 0;
  itemsNames.forEach(name => {
    let item = itemsTable[name];
    let newItem = item["new"];
    let totalItem = item["total"];
    let region = newItem.region + "," + newItem.subregion;
    pageSrc += `
      style { "fontSize": 12} row [
        two-columns [
          br, style {"fontWeight": 600} "${region}",
          br, "${yesterday.toUTCString().slice(0, 16)}"
        ]
        five-columns [
          br, href "form?id=${newItem.id}" resize img "https://cdn.acx.ac/${newItem.id}.png",
          br, style {"fontSize": 10, "marginLeft": 25} "${newItem.total + ' New ' + TYPE}",
        ],
        five-columns [
          br, href "form?id=${totalItem.id}" resize img "https://cdn.acx.ac/${totalItem.id}.png",
          br, style {"fontSize": 10, "marginLeft": 25} "${totalItem.total + ' Total ' + TYPE}",
        ]
      ]`;
    ids.push(newItem.id);
    ids.push(totalItem.id);
  });
  pageSrc += "].."
  return pageSrc;
}

build();

