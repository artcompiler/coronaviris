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

const DEATHS_CHART_ID = "RQ6sx0LgOCr";
const CASES_CHART_ID = "7OBfeV7AlUO";
const RECOVERED_CHART_ID = "7OBfeV7AlUO";
const TYPE = "new deaths in 28 days";

function generate() {
  let data = [];
  fs.createReadStream('./data/county-new-deaths.csv')
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
        total += value;
      });
      if (total >= 10) {
        data.push({
          id: DEATHS_CHART_ID,
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
  let regionTable = {};   // { name, total, subregion }
  let regions = [];
  data.forEach((v) => {
    let [region, subregion] = v.data.region.split(",");
    let values = v.data.values;
    let total = 0;
    regions.push(v.data);
    values.forEach(v => {
      total += !isNaN(+v[1]) && v[1] || 0;
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
    let data = regionTable[region].subregions;
    data.sort((a, b) => {
      return b.total - a.total;
    });
    let total = 0;
    data.forEach(v => {
      total += v.total;
    });
    regionTable[region].total = total;
    // let regionPage;
    // regionPage  = "\nlet resize = <x: style { 'width': 250 } x>..\n";
    // regionPage += "grid [\n";
    // regionPage += 'row twelve-columns [br, ';
    // // regionPage += 'style { "fontSize": "10"} cspan "Posted: ' + date.toUTCString() + '"';
    // regionPage += '],\n';
    putComp(secret, data, (err, val) => {
      const date = new Date();
      const yesterday = new Date();
      yesterday.setDate(date.getDate() - 1);
      // let pageStr;
      // pageStr  = "\nlet resize = <x: style { 'width': 250 } x>..\n";
      // pageStr += "grid [\n";
      // pageStr += 'row twelve-columns [br, ';
      // pageStr += 'style { "fontSize": "10"} cspan "Posted: ' + date.toUTCString() + '"';
      // pageStr += '],\n';
      // let completed = 0;
      // let ids = [];
      // val && val.length && val.forEach((v, i) => {
      //   let region = v.region + "," + v.subregion;
      //   pageStr +=
      //     'row twelve-columns [br, ' +
      //     'href "item?id=' + v.id + '" resize img "https://cdn.acx.ac/' + v.id + '.png", ' +
      //     'br, ' +
      //     'cspan "' + region + ', ' + yesterday.toUTCString().slice(0, 16) + '"' + 'br, cspan "' + v.total + " " + TYPE + '"' +
      //     ']\n';
      //   ids.push(v.id);
      // });
      // pageStr += "]..";
      let pageSrc = renderPage(val, date, yesterday, allIDs);
      putCode(secret, {
        language: "L116",
        src: pageSrc,
      }, async (err, val) => {
        console.log("PUT /comp proofsheet: https://gc.acx.ac/form?id=" + val.id);
        if (allIDs.length === totalCharts) {
          console.log("compile() allIDs=" + JSON.stringify(allIDs));
          batchScrape(SCALE, false, allIDs, 0, (err, obj) => {
            if (err) {
              console.log("scrape() err=" + JSON.stringify(err));
              reject(err);
            } else {
              console.log("done");
              //console.log(JSON.stringify(regionTable, null, 2));
            }
          });
        }
      });
    });
  });

  function renderPage(items, now, yesterday, ids) {
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
        'href "item?id=' + item.id + '" resize img "https://cdn.acx.ac/' + item.id + '.png", ' +
        'br, ' +
          'cspan "' + region + ', ' + yesterday.toUTCString().slice(0, 16) + '"' + 'br, cspan "' + item.total + " " + TYPE + '"' +
        ']\n';
      ids.push(item.id);
    });
    pageSrc += "].."
    return pageSrc;
  }  
}

build();

