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

const CHART_ID = "RQ6sx0LgOCr";

function generate() {
  let data = [];
  fs.createReadStream('./data/daily-deaths.csv')
    .pipe(csv())
    .on('data', (row) => {
      const state = row["Province/State"];
      const country = row["Country/Region"];
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
      if (total > 100) {
        data.push({
          id: CHART_ID,
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
  console.log("putComp() secret=" + secret + " data=" + JSON.stringify(data));
  const encodedData = JSON.stringify(data);
  const options = {
    host: "localhost", //"gc.acx.ac",
    port: "3000", //"443",
    path: "/comp",
    method: "PUT",
    headers: {
      "Content-Type": "text/plain",
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
        console.log("putComp() data=" + JSON.stringify(data));
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


function compile(data) {
  const secret = process.env.ARTCOMPILER_CLIENT_SECRET;
  putComp(secret, data, (err, val) => {
    const date = new Date().toUTCString();
    let pageStr = "grid [\n";
    pageStr += 'row twelve-columns [br, ';
    pageStr += 'style { "fontSize": "10"} cspan "Posted: ' + date + '"';
    pageStr += '],\n';
    let completed = 0;
    val && val.length && val.forEach((v, i) => {
//      console.log("compile() v=" + JSON.stringify(v, null, 2));
      pageStr +=
        'row twelve-columns [br, cspan "' + v.data.args.region +
        '", href "item?id=' + v.id +
        '" img "https://cdn.acx.ac/' + v.id + '.png' +
//        '" style { \"height\": 200} graffito "' + v.id +
        '"]\n';
      postSnap(v.id, (err, data) => {
        completed++;
        console.log(completed + " of " + val.length + " charts compiled");
      });
    });
    pageStr += "]..";
    console.log("compile() pageStr=" + pageStr);
  })
}

build();

