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
    compile(data);
  });
}

const DEATHS_CHART_ID = "RQ6sx0LgOCr";
const CASES_CHART_ID = "7OBfeV7AlUO";
const RECOVERED_CHART_ID = "7OBfeV7AlUO";

function generate() {
  let data = [];
  fs.createReadStream('./data/county-new-deaths.csv')
    .pipe(csv())
    .on('data', (row) => {
      const state = row["State"];
      const country = row["County Name"];
      const region = (state && (state + ", ") || "") + country;
      const keys = Object.keys(row);
      const dates = keys.slice(keys.length - 28);
      const obj = {
        region: state === country && country || region,
        values: [
          ["Date", "Deaths"],
        ],
      };
      let total = 0;
      dates.forEach(date => {
        let value = +row[date];
        obj.values.push([date, value]);
        total += value;
      });
      if (total >= 1) {
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

function compile(data) {
  console.log("Compiling...");
  const secret = process.env.ARTCOMPILER_CLIENT_SECRET;
  putComp(secret, data, (err, val) => {
    const date = new Date();
    const yesterday = new Date();
    yesterday.setDate(date.getDate() - 1);
    let pageStr;
    pageStr  = "\nlet resize = <x: style { 'width': 250 } x>..\n";
    pageStr += "grid [\n";
    pageStr += 'row twelve-columns [br, ';
    pageStr += 'style { "fontSize": "10"} cspan "Posted: ' + date.toUTCString() + '"';
    pageStr += '],\n';
    let completed = 0;
    let ids = [];
    val && val.length && val.forEach((v, i) => {
      pageStr +=
        'row twelve-columns [br, ' +
        'href "item?id=' + v.id + '" resize img "https://cdn.acx.ac/' + v.id + '.png", ' +
        'br, ' +
        'cspan "' + v.data.args.region + ', ' + yesterday.toUTCString().slice(0, 16) + '"' +
        ']\n';
      ids.push(v.id);
    });
    pageStr += "]..";
    batchScrape(SCALE, false, ids, 0 , (err, data) => {
      completed++;
    });
    console.log("compile() pageStr=" + pageStr);
  });
}

build();

