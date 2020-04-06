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
}

const FILES = [
 '../build/data/us-cases.json',
 '../build/data/us-deaths.json',
 '../build/data/spain-cases.json',
 '../build/data/spain-deaths.json',
  '../build/data/switzerland-cases.json',
];

function build() {
  clean();
  FILES.forEach(file => {
    generate(file);
  });
}

const DATE_RANGE = 29;

const DEATHS_TYPE = "deaths";
const CASES_TYPE = "cases";

const US_REGION = "US";
const UK_REGION = "UK";
const SPAIN_REGION = "Spain";

const NEW = false;

const DEATHS_CHART_ID = "4LJhbQ57mSw";
const CASES_CHART_ID = "1MNSpQ7RXHN";
const RECOVERED_CHART_ID = "";

const THRESHOLD = 1;

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

function getChartIDFromType(type) {
  switch(type) {
  case DEATHS_TYPE:
    return DEATHS_CHART_ID;
  case CASES_TYPE:
    return CASES_CHART_ID;
  }
  return null;
}

function generate(file) {
  const rows = require(file);
  const fileName = file.split('/').pop();
  const [country, suffix] = fileName.toLowerCase().split("-");
  const type = suffix.split(".")[0];
  const chartID = getChartIDFromType(type);
  const data = [];
  rows.forEach(row => {
    const region = row["regionName"];
    const group = row["groupName"];
    const keys = Object.keys(row.values);
    const dates = keys.slice(keys.length > DATE_RANGE && keys.length - DATE_RANGE || 0);
    const objNew = {
      region: group + ', ' + region,
      isNew: true,
      values: [],
    };
    const objTotal = {
      region: group + ', ' + region,
      isNew: false,
      values: [],
    };
    let lastDate;
    let value;
    dates.forEach((date, i) => {
      let currVal = row.values[date] || '0';
      let lastVal = row.values[lastDate] || '0';
      let newValue = currVal - lastVal;
      let totalValue = currVal;
      if (!isNaN(newValue)) {
        objNew.values.push([date, newValue]);
      }
      if (!isNaN(totalValue)) {
        objTotal.values.push([date, totalValue]);
      }
      lastDate = date;
    });
    let date = new Date(lastDate);
    date.setDate(date.getDate() - objNew.values.length + 1);
    for (let i = DATE_RANGE - objNew.values.length; i > 0; i--) {
      let dateStr = date.getMonth() + "/" + date.getDate() + "/" + date.getFullYear();
      objNew.values.unshift([dateStr, 0]);
      date.setDate(date.getDate() - 1);
    }
    objNew.values.unshift(["Date", "Count"]);
    date = new Date(lastDate);
    date.setDate(date.getDate() - objTotal.values.length + 1);
    for (let i = DATE_RANGE - objTotal.values.length; i > 0; i--) {
      let dateStr = date.getMonth() + "/" + date.getDate() + "/" + date.getFullYear();
      objTotal.values.unshift([dateStr, 0]);
      date.setDate(date.getDate() - 1);
    }
    objTotal.values.unshift(["Date", "Count"]);
    if (+row.values[lastDate] >= THRESHOLD) {
      data.push({
        id: chartID,
        data: objNew,
      });
      data.push({
        id: chartID,
        data: objTotal,
      });
    }
  });
  console.log(data.length / 2 + ' items found');
  compile(data, country, type, val => {
  });
}

const SCALE = 4;
const secret = process.env.ARTCOMPILER_CLIENT_SECRET;
function compile(data, country, type, resume) {
  // data = [{id, data: {region, values}}]
  console.log("Compiling...");
  let allIDs = [];
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
      let pageSrc = renderRegionPage(valNew, type, date, yesterday, allIDs);
      putCode(secret, {
        language: "L116",
        src: pageSrc,
      }, async (err, val) => {
        // console.log("PUT /comp Region Page: https://gc.acx.ac/form?id=" + val.id);
        regionTable[region].id = val.id;
        if (allIDs.length === totalCharts) {
          // All subregion charts have been compiled. Now render region charts.
          let frontPage = renderFrontPage(regionItems, type, date, yesterday);
          putCode(secret, {
            language: "L116",
            src: frontPage,
          }, async (err, val) => {
            console.log("PUT /comp Front Page: https://gc.acx.ac/form?id=" + val.id);
            resume({
              country: country,
              type: type,
              id: val.id
            });
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

function renderFrontPage(items, type, now, yesterday) {
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
    // console.log("renderFrontPage() item=" + JSON.stringify(item, null, 2));
    let region = item.region;
    pageSrc +=
    'style { "fontSize": "12"} row twelve-columns [br, ' +
      'href "form?id=' + item.id + '" "' + region + '", ' +
      'br, "' + item['total'] + ' total ' + type + '", br, ' +
      '"' + yesterday.toUTCString().slice(0, 16) + '"' +
      ']\n';
  });
  pageSrc += "].."
  return pageSrc;
}

function renderRegionPage(items, type, now, yesterday, ids) {
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
          br, style {"fontSize": 11, "fontWeight": 600, "opacity": .4, "marginLeft": 25} "New ${type} by day",
        ],
        five-columns [
          br, href "form?id=${totalItem.id}" resize img "https://cdn.acx.ac/${totalItem.id}.png",
          br, style {"fontSize": 11, "fontWeight": 600, "opacity": .4, "marginLeft": 25} "Total ${type} by day",
        ]
      ]`;
    ids.push(newItem.id);
    ids.push(totalItem.id);
  });
  pageSrc += "].."
  return pageSrc;
}

build();

