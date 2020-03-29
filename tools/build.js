// STEPS
// x-- Generate L114 data
// -- Compile charts
// -- Scrape charts
// -- Render static html page
// -- Push to repo

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
  generate(data => {
    compile(data, data => {
    });
  });
}

function updateData() {
  exec("curl https://usafactsstatic.blob.core.windows.net/public/data/covid-19/covid_confirmed_usafacts.csv > data/covid_confirmed_usafacts.csv");
  exec("curl https://usafactsstatic.blob.core.windows.net/public/data/covid-19/covid_deaths_usafacts.csv > data/covid_deaths_usafacts.csv");
}

const DEATHS_TYPE = "Deaths";
const CASES_TYPE = "Cases";
const TYPE = DEATHS_TYPE;
const DEATHS_CHART_ID = "RQ6sx0LgOCr";
const CASES_CHART_ID = "7OBfeV7AlUO";
const RECOVERED_CHART_ID = "7OBfeV7AlUO";
const DATA_FILE =
      TYPE === DEATHS_TYPE && './data/covid_deaths_usafacts.csv' ||
      TYPE === CASES_TYPE && './data/covid_confirmed_usafacts.csv';
const THRESHOLD =
      TYPE === DEATHS_TYPE && 1 ||
      TYPE === CASES_TYPE && 10;

function generate() {
  let data = [];
  fs.createReadStream(DATA_FILE)
    .pipe(csv())
    .on('data', (row) => {
      const state = row["State"];
      const county = row["County Name"];
      const region = (state && (state + ", ") || "") + county;
      const keys = Object.keys(row);
      const dates = keys.slice(keys.length - 28);
      const obj = {
        region: state === county && county || region,
        values: [
          ["Date", "Count"],
        ],
      };
      let total = 0;
      dates.forEach(date => {
        let value = +row[date];
        obj.values.push([date, value]);
//        total += value;   // If new case/deaths, aggregate.
        total = value;
      });
      if (total >= THRESHOLD) {
        data.push({
          id: TYPE.toLowerCase().indexOf("cases") > 0 && CASES_CHART_ID || DEATHS_CHART_ID,
          data: obj
        });
      }
    })
    .on('end', () => {
      fs.writeFile('build/data/daily-deaths.l114.json', JSON.stringify(data, null, 2), () => {
        console.log(data.length + ' items found');
      });
      compile(data);
      console.log('CSV file successfully processed');
    });
}

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

const SCALE = 2;
const secret = process.env.ARTCOMPILER_CLIENT_SECRET;
let allIDs = [];
function compile(data, resume) {
  let totalCharts = data.length;
  let count = 0;
  console.log("Compiling...");
  let regionTable = {};   // { name, total, subregions, data }
  let regions = [];
  let regionItems = [];
  data.forEach((v) => {
    let [region, subregion] = v.data.region.split(",");
    let values = v.data.values;
    let total = 0;
    regions.push(v.data);
    values.forEach(v => {
//      total += !isNaN(+v[1]) && v[1] || 0;   // If new cases, aggregate.
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
      total: total,
      data: {
        region: region,
        values: values,
      },
    });
  });
  Object.keys(regionTable).forEach(region => {
    // For each region
    // -- Sort subregions
    // -- Compute region total
    // -- Compile individual charts
    // -- Render the page for that region
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
    putComp(secret, data, (err, val) => {
      // Charts compiled.
      const date = new Date();
      const yesterday = new Date();
      yesterday.setDate(date.getDate() - 1);
      let pageSrc = renderRegionPage(val, date, yesterday, allIDs);
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
  pageSrc += 'style { "fontSize": "10"} cspan "Posted: ' + now.toUTCString() + '"';
  pageSrc += '],\n';
  let completed = 0;
  items.sort((a, b) => {
    return b.total - a.total;
  });
  items && items.length && items.forEach((item, i) => {
//    console.log("renderFrontPage() item=" + JSON.stringify(item, null, 2));
    let region = item.region;
    pageSrc +=
    'row twelve-columns [br, ' +
//      'href "item?id=' + item.id + '" resize img "https://cdn.acx.ac/' + item.id + '.png", ' +
      'href "form?id=' + item.id + '" "' + region + '", ' +
      'br, ' +
      'cspan "' + region + ', ' + yesterday.toUTCString().slice(0, 16) + '"' + 'br, cspan "' + item.total + " " + TYPE + '"' +
      ']\n';
  });
  pageSrc += "].."
  return pageSrc;
}  

function renderRegionPage(items, now, yesterday, ids) {
  // item = {region, subregion, total, id}
  let pageSrc = "";
  pageSrc += "\nlet resize = <x: style { 'width': 250 } x>..\n";
  pageSrc += "grid [\n";
  pageSrc += 'row twelve-columns [br, ';
  pageSrc += 'style { "fontSize": "10"} cspan "Posted: ' + now.toUTCString() + '"';
  pageSrc += '],\n';
  let completed = 0;
  items && items.length && items.forEach((item, i) => {
    let region = item.region + "," + item.subregion;
    pageSrc +=
      'row twelve-columns [br, ' +
      'href "form?id=' + item.id + '" resize img "https://cdn.acx.ac/' + item.id + '.png", ' +
      'br, ' +
      'cspan "' + region + ', ' + yesterday.toUTCString().slice(0, 16) + '"' + 'br, cspan "' + item.total + " " + TYPE + '"' +
      ']\n';
    ids.push(item.id);
  });
  pageSrc += "].."
  return pageSrc;
}  

build();

