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
  '../build/data/owid-world.json',
  // '../build/data/usafacts-us-counties.json',
  '../build/data/nyt-us.json',
  '../build/data/nyt-us-states.json',
  '../build/data/nyt-us-counties.json',
];
const SCALE = 5; //FILES.length;

function build() {
  clean();
  FILES.forEach(file => {
    generate(file);
  });
}

const DEATHS_TYPE = "Deaths";
const CASES_TYPE = "Cases";

const US_REGION = "US";
const UK_REGION = "UK";
const SPAIN_REGION = "Spain";

const NEW = false;

const DEATHS_CHART_ID = "l16CBlVv2fX";
const CASES_CHART_ID = "Je1cxWV8bsx";
const RECOVERED_CHART_ID = "";

const THRESHOLD = 20;

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

const DATE_RANGE = 31;  // 28 + 2 (for three day averaging of the first value)

function generate(file) {
  const rows = require(file);
  const fileName = file.split('/').pop();
  const dataSource = rows[0].dataSource;
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
      type: 'New Cases',
      values: [],
    };
    const objTotalCases = {
      parent: parent,
      region: region,
      type: 'Total Cases',
      values: [],
    };
    const objNewDeaths = {
      parent: parent,
      region: region,
      type: 'New Deaths',
      values: [],
    };
    const objTotalDeaths = {
      parent: parent,
      region: region,
      type: 'Total Deaths',
      values: [],
    };
    let prevDate;
    let value;
    let rawCaseValues = [0, 0, 0];
    let rawDeathValues = [0, 0, 0];
    function rollingAvg(vals, val) {
      vals.push(val);
      const len = vals.length;
      const avg = Math.ceil((vals[len - 1] + vals[len - 2] + vals[len - 1]) / 3);
      return val > avg && val || avg;
    }
    dates.forEach((date, i) => {
      if (date === 'null') {
        return;
      }
      // Smoothing: add last three raw values, divide by three and get the ceiling of the result.
//      let currValCases = row.cases[date] = rollingAvg(rawCaseValues, row.cases[date] || 0);
      let prevValCases = +row.cases[prevDate] || 0;  // Already been averaged.
      let currValCases = +row.cases[date] || prevValCases || 0;
      let newValCases = currValCases - prevValCases;
      let totalValCases = currValCases || prevValCases;
//      let currValDeaths = row.deaths[date] = rollingAvg(rawDeathValues, row.deaths[date] || 0);
      let prevValDeaths = +row.deaths[prevDate] || 0;
      let currValDeaths = +row.deaths[date] || prevValDeaths || 0;
      let newValDeaths = currValDeaths - prevValDeaths;
      let totalValDeaths = currValDeaths || prevValDeaths;  // Last one is the total.
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
    function sliceAndLabelValues(values) {
      values = values.slice(values.length - 29);
      values.unshift(["Date", "Count"]);
      return values;
    }
    objNewCases.values = sliceAndLabelValues(objNewCases.values);
    objTotalCases.values = sliceAndLabelValues(objTotalCases.values);
    objNewDeaths.values = sliceAndLabelValues(objNewDeaths.values);
    objTotalDeaths.values = sliceAndLabelValues(objTotalDeaths.values);
    date = new Date(prevDate);
    date.setDate(date.getDate() - objTotalCases.values.length + 1);
    let sevenDayDeathTotal = 0;
    let objNewDeathsValues = objNewDeaths.values;
    for (let i = objNewDeathsValues.length - 1; i > objNewDeathsValues.length - 8; i--) {
      sevenDayDeathTotal += objNewDeathsValues[i][1];
    }
    if (+row.deaths[prevDate] >= THRESHOLD) {
    //if (sevenDayDeathTotal >= THRESHOLD) {
      if (!data[parent]) {
        data[parent] = {
          dataSource: dataSource,
          parent: country,
          region: parent,
          values: {},
        };
      }
      if (!data[parent].values[region]) {
        data[parent].values[region] = {
          parent: parent,
          region: region,
          sevenDayDeathTotal: sevenDayDeathTotal,
        };
      }
      data[parent].values[region].newCases = {
        id: CASES_CHART_ID,
        parent: parent,
        region: region,
        type: "New Cases",
        data: objNewCases,
      };
      data[parent].values[region].totalCases = {
        id: CASES_CHART_ID,
        parent: parent,
        region: region,
        type: "Total Cases",
        data: objTotalCases,
      };
      data[parent].values[region].newDeaths = {
        id: DEATHS_CHART_ID,
        parent: parent,
        region: region,
        type: "New Deaths",
        data: objNewDeaths,
      };
      data[parent].values[region].totalDeaths = {
        id: DEATHS_CHART_ID,
        parent: parent,
        region: region,
        type: "Total Deaths",
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
  let dataSource;
  regionNames.forEach(regionName => {
    const region = data[regionName];
    if (!dataSource) {
      dataSource = region.dataSource;
    }
    compileRegion(schema, region, (err, val) => {
      items.push({
        dataSource: dataSource,
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
  const dataSource = data.dataSource;
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
        dataSource: dataSource,
        parent: region,
        region: subRegionName,
        id: val.id,
        pageSrc: val.pageSrc,
        totalCases: val.totalCases,
        totalDeaths: val.totalDeaths,
        sevenDayDeaths: subRegion.sevenDayDeathTotal,
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
  if (items[0].dataSource) {
    pageSrc += '"Data from: ", href "' + items[0].dataSource + '" "' + items[0].dataSource + '"';
  }
  pageSrc += 'br, "Posted: ' + now.toUTCString() + '"';
  pageSrc += '],\n';
  pageSrc += 'row twelve-columns [br, "Sorted by total deaths."],';
  let completed = 0;
  items.sort((a, b) => {
    return b.totalDeaths - a.totalDeaths;
  });
  items && items.length && items.forEach((item, i) => {
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
  if (items[0].dataSource) {
    pageSrc += '"Data from: ", href "' + items[0].dataSource + '" "' + items[0].dataSource + '"';
  }
  pageSrc += 'br, "Posted: ' + now.toUTCString() + '"';
  pageSrc += '],\n';
  pageSrc += 'row twelve-columns [br, "Sorted by the number of deaths in the last seven days."],';
  let completed = 0;
  items.sort((a, b) => {
    return b.sevenDayDeaths - a.sevenDayDeaths;
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
    let newCasesItem = item["New Cases"];
    let totalCasesItem = item["Total Cases"];
    let newDeathsItem = item["New Deaths"];
    let totalDeathsItem = item["Total Deaths"];
    let region = newCasesItem.region + ', ' + newCasesItem.parent;
    pageSrc += `
    style {"fontSize": 12, "height": 100, "textAlign": "center"} row [
        twelve-columns [
          br, br, br, style {"fontWeight": 600} "${region}",
          br, "${yesterday.toUTCString().slice(0, 16)}"
        ]
      ]`;
    pageSrc += `
      style { "fontSize": 12, "height": 175, "textAlign": "center"} row [
        six-columns [
          href "form?id=${newDeathsItem.id}" resize img "https://cdn.acx.ac/${newDeathsItem.id}.png",
        ],
        six-columns [
          href "form?id=${totalDeathsItem.id}" resize img "https://cdn.acx.ac/${totalDeathsItem.id}.png",
        ]
      ]`;
    pageSrc += `
      style { "fontSize": 12, "height": 175, "textAlign": "center"} row [
        six-columns [
          href "form?id=${newCasesItem.id}" resize img "https://cdn.acx.ac/${newCasesItem.id}.png",
        ],
        six-columns [
          href "form?id=${totalCasesItem.id}" resize img "https://cdn.acx.ac/${totalCasesItem.id}.png",
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
