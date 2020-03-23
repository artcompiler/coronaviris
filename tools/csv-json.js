const csv = require('csv-parser');
const fs = require('fs');
fs.createReadStream('daily-deaths.csv')
  .pipe(csv())
  .on('data', (row) => {
    const state = row["Province/State"];
    const country = row["Country/Region"];
    const region = (state && (state + ", ") || "") + country;
    const keys = Object.keys(row);
    const dates = keys.slice(keys.length - 28);
    const obj = {
      region: state === country && country || region,
    };
    let total = 0;
    dates.forEach(date => {
      total += obj[date] = +row[date];
    });
    if (total > 9) {
      console.log(JSON.stringify(obj, null, 2) + ",");
    }
  })
  .on('end', () => {
    console.log('CSV file successfully processed');
  });
