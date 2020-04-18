/*
   TODO
   xx Compute daily values from totals
   -- Fix negative new values
   -- Render group charts
   -- Add demographic data
   -- Add attribution
   --
*/
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
  '../build/data/us.json',
//  '../build/data/spain-cases.json',
//  '../build/data/spain-deaths.json',
//  '../build/data/switzerland-cases.json',
];
const SCALE = 5; //FILES.length;

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

const THRESHOLD = 2;

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
    host: "gc.acx.ac",
    port: "443",
    path: "/code",
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
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
  const [country] = fileName.toLowerCase().split("-");
  const type = "cases";
  const chartID = getChartIDFromType(type);
  const data = {};
  rows.forEach(row => {
    const region = row["regionName"];
    const parent = row["groupName"];
    const fullName = parent + ', ' + region;
    const keys = Object.keys(row.cases);
    const dates = keys.slice(keys.length > DATE_RANGE && keys.length - DATE_RANGE || 0);
    const objNewCases = {
      parent: parent,
      region: region,
      type: 'new cases',
      values: [],
    };
    const objTotalCases = {
      parent: parent,
      region: region,
      type: 'total cases',
      values: [],
    };
    const objNewDeaths = {
      parent: parent,
      region: region,
      type: 'new deaths',
      values: [],
    };
    const objTotalDeaths = {
      parent: parent,
      region: region,
      type: 'total deaths',
      values: [],
    };
    let prevDate;
    let value;
    dates.forEach((date, i) => {
      if (date === 'null') {
        return;
      }
      let currValCases = row.cases[date] || 0;
      let prevValCases = row.cases[prevDate] || 0;
      let newValCases = currValCases - prevValCases;
      let totalValCases = currValCases;
      let currValDeaths = row.deaths[date] || 0;
      let prevValDeaths = row.deaths[prevDate] || 0;
      let newValDeaths = currValDeaths - prevValDeaths;
      let totalValDeaths = currValDeaths;  // Last one is the total.
      if (!isNaN(newValCases)) {
        objNewCases.values.push([date, newValCases]);
      }
      if (!isNaN(totalValCases)) {
        objTotalCases.values.push([date, totalValCases]);
      }
      if (!isNaN(newValDeaths)) {
        objNewDeaths.values.push([date, newValDeaths]);
      }
      if (!isNaN(totalValDeaths)) {
        objTotalDeaths.values.push([date, totalValDeaths]);
      }
      prevDate = date;
    });
    let date = new Date(prevDate);
    date.setDate(date.getDate() - objNewCases.values.length + 1);
    for (let i = DATE_RANGE - objNewCases.values.length; i > 0; i--) {
      // Add zero values for day for which there is no data.
      // FIXME negative values.
      let dateStr = date.getMonth() + "/" + date.getDate() + "/" + date.getFullYear();
      objNewCases.values.unshift([dateStr, 0]);
      objTotalCases.values.unshift([dateStr, 0]);
      objNewDeaths.values.unshift([dateStr, 0]);
      objTotalDeaths.values.unshift([dateStr, 0]);
      date.setDate(date.getDate() - 1);
    }
    objNewCases.values.unshift(["Date", "Count"]);
    objTotalCases.values.unshift(["Date", "Count"]);
    objNewDeaths.values.unshift(["Date", "Count"]);
    objTotalDeaths.values.unshift(["Date", "Count"]);
    date = new Date(prevDate);
    date.setDate(date.getDate() - objTotalCases.values.length + 1);
    if (+row.deaths[prevDate] >= THRESHOLD) {
      if (!data[parent]) {
        data[parent] = {
          parent: country,
          region: parent,
          values: {},
        };
      }
      if (!data[parent].values[region]) {
        data[parent].values[region] = {
          parent: parent,
          region: region,
        };
      }
      data[parent].values[region].newCases = {
        id: CASES_CHART_ID,
        parent: parent,
        region: region,
        type: "new cases",
        data: objNewCases,
      };
      data[parent].values[region].totalCases = {
        id: CASES_CHART_ID,
        parent: parent,
        region: region,
        type: "total cases",
        data: objTotalCases,
      };
      data[parent].values[region].newDeaths = {
        id: DEATHS_CHART_ID,
        parent: parent,
        region: region,
        type: "new deaths",
        data: objNewDeaths,
      };
      data[parent].values[region].totalDeaths = {
        id: DEATHS_CHART_ID,
        parent: parent,
        region: region,
        type: "total deaths",
        data: objTotalDeaths,
      };
    }
  });
  compile({}, data, (err, val) => {
  });
}

const secret = process.env.ARTCOMPILER_CLIENT_SECRET;

function compile(schema, data, resume) {
  console.log("Compiling...");
  const regionNames = Object.keys(data);
  let count = 0;
  let chartIDs = [];
  let items = [];
  regionNames.forEach(regionName => {
    const region = data[regionName];
    compileRegion(schema, region, (err, val) => {
      items.push({
        id: val.pageID,
        region: regionName,
        totalCases: val.totalCases,
        totalDeaths: val.totalDeaths,
      });
      chartIDs = chartIDs.concat(val.chartIDs);
      count++;
      if (count === regionNames.length) {
        renderTopPage(items, (err, val) => {
          batchScrape(SCALE, false, chartIDs, 0, (err, obj) => {
            if (err) {
              console.log("scrape() err=" + JSON.stringify(err));
              reject(err);
            } else {
              console.log("done");
            }
          });
        });
      }
      resume(err, val);
    });
  });
}

function compileRegion(schema, data, resume) {
  const parent = data.parent;
  const region = data.region;
  const values = data.values;
  const subRegionNames = Object.keys(values);
  const items = [];
  let chartIDs = [];
  let totalCases = 0, totalDeaths = 0;
  subRegionNames.forEach(subRegionName => {
    // For each region, compile the charts of each sub region.
    const subRegion = data.values[subRegionName];
    compileSubRegion({}, subRegion, (err, val) => {
      items.push({
        parent: region,
        region: subRegionName,
        id: val.id,
        pageSrc: val.pageSrc,
      });
      chartIDs = chartIDs.concat(val.chartIDs);
      totalCases += val.totalCases;
      totalDeaths += val.totalDeaths;
      if (items.length === subRegionNames.length) {
        renderRegionPage(items, (err, val) => {
          resume(err, {
            pageID: val.id,
            items: items,
            chartIDs: chartIDs,
            totalCases: totalCases,
            totalDeaths: totalDeaths,
          });
        });
      }
    });
  });
}

function compileSubRegion(schema, data, resume) {
  const ids = [];
  putComp(secret, [data.newCases, data.totalCases, data.newDeaths, data.totalDeaths], (err, val) => {
    const date = new Date();
    const yesterday = new Date();
    yesterday.setDate(date.getDate() - 1);
//    console.log("compileSubRegion() data=" + JSON.stringify(data, null, 2));
    const totalCasesValues = data.totalCases.data.values;
    const totalDeathsValues = data.totalDeaths.data.values;
    renderSubRegionPage(val, date, yesterday, (err, val) => {
      val.totalCases = totalCasesValues[totalCasesValues.length - 1][1],
      val.totalDeaths = totalDeathsValues[totalDeathsValues.length - 1][1],
      resume(err, val)
    });
  });
}

function formatNumber(val) {
  val = "" + val;
  formatted = "";
  for (let i = 0; i < val.length; i++) {
    if (i !== 0 && (val.length - i) % 3 === 0) {
      formatted += ",";
    }
    formatted += val[i];
  }
  return formatted;
}

function renderTopPage(items, resume) {
  // item = {region, total, id}
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  let pageSrc = "";
  pageSrc += "\nlet resize = <x: style { 'width': 250 } x>..\n";
  pageSrc += 'title "COVID-19"';
  pageSrc += "grid [\n";
  pageSrc += 'row twelve-columns [br, ';
  pageSrc += 'style { "fontSize": "12"} cspan "Posted: ' + now.toUTCString() + '"';
  pageSrc += '],\n';
  let completed = 0;
  items.sort((a, b) => {
    return b.totalDeaths - a.totalDeaths;
  });
  items && items.length && items.forEach((item, i) => {
    // console.log("renderFrontPage() item=" + JSON.stringify(item, null, 2));
    let region = item.region;
    pageSrc += `
    style { "fontSize": "12"} row twelve-columns [
      br, 
      href "form?id=${item.id}" "${region}",
      br,
      "${formatNumber(item.totalDeaths)} Deaths",
      br,
      "${formatNumber(item.totalCases)} Cases"
    ]
    `;
  });
  pageSrc += "].."
  putCode(secret, {
    language: "L116",
    src: pageSrc,
  }, async (err, val) => {
    console.log("PUT /comp Top Page: https://gc.acx.ac/form?id=" + val.id);
    resume(err, val);
  });
}

function renderRegionPage(items, resume) {
  // item = {region, total, id}
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  let pageSrc = "";
  pageSrc += "\nlet resize = <x: style { 'width': 250 } x>..\n";
  pageSrc += 'title "COVID-19 in ' + items[0].parent + '"';
  pageSrc += "grid [\n";
  pageSrc += 'row twelve-columns [br, ';
  pageSrc += 'style { "fontSize": "12"} cspan "Posted: ' + now.toUTCString() + '"';
  pageSrc += '],\n';
  let completed = 0;
  items.sort((a, b) => {
    return b.total - a.total;
  });
  items && items.length && items.forEach((item, i) => {
    let region = item.region + ', ' + item.parent;
    pageSrc += item.pageSrc;
  });
  pageSrc += "].."
  putCode(secret, {
    language: "L116",
    src: pageSrc,
  }, async (err, val) => {
    // console.log("PUT /comp Front Page: https://gc.acx.ac/form?id=" + val.id);
    resume(err, val);
  });
}

function renderSubRegionPage(items, now, yesterday, resume) {
  const itemsTable = {};
  const itemsNames = [];
  const ids = [];
  items.forEach(item => {
    const name = item.parent + ", " + item.region;
    const type = item.type;
    if (!itemsTable[name]) {
      itemsTable[name] = {};
      itemsNames.push(name);
    }
    itemsTable[name][type] = item;
  });
  let pageSrc = "";
  let completed = 0;
  itemsNames.forEach(name => {
    let item = itemsTable[name];
    let newCasesItem = item["new cases"];
    let totalCasesItem = item["total cases"];
    let newDeathsItem = item["new deaths"];
    let totalDeathsItem = item["total deaths"];
    let region = newCasesItem.region + ', ' + newCasesItem.parent;
    pageSrc += `
    style { "fontSize": 12, "height": 130 } row [
        two-columns [
          br, style {"fontWeight": 600} "${region}",
          br, "${yesterday.toUTCString().slice(0, 16)}"
        ]
        five-columns [
          br, br, br, style {"fontWeight": 600, "opacity": .6} "NEW",
        ],
        five-columns [
          br, br, br, style {"fontWeight": 600, "opacity": .6} "TOTAL",
        ]
      ]`;
    pageSrc += `
      style { "fontSize": 12, "height": 175} row [
        two-columns [
          style {"fontWeight": 600, "opacity": .6} "CASES",
        ],
        five-columns [
          href "form?id=${newCasesItem.id}" resize img "https://cdn.acx.ac/${newCasesItem.id}.png",
        ],
        five-columns [
          href "form?id=${totalCasesItem.id}" resize img "https://cdn.acx.ac/${totalCasesItem.id}.png",
        ]
      ]`;
    pageSrc += `
      style { "fontSize": 12, "height": 175} row [
        two-columns [
          style {"fontWeight": 600, "opacity": .6} "DEATHS",
        ],
        five-columns [
          href "form?id=${newDeathsItem.id}" resize img "https://cdn.acx.ac/${newDeathsItem.id}.png", 
        ],
        five-columns [
          href "form?id=${totalDeathsItem.id}" resize img "https://cdn.acx.ac/${totalDeathsItem.id}.png",
        ]
      ]`;
    ids.push(newCasesItem.id);
    ids.push(totalCasesItem.id);
    ids.push(newDeathsItem.id);
    ids.push(totalDeathsItem.id);
  });
  resume([], {
    pageSrc: pageSrc,
    chartIDs: ids,
  });
}

build();
