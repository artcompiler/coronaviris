build:
	node tools/build.js

convert:
	rm -rf build
	mkdir build
	mkdir build/data
	node tools/convert-owid-world.js
	node tools/convert-nyt-us-counties.js
	node tools/convert-nyt-us-states.js
	node tools/convert-nyt-us.js

refresh:
	curl https://covid.ourworldindata.org/data/owid-covid-data.csv > data/owid-world.csv
	curl https://raw.githubusercontent.com/nytimes/covid-19-data/master/us-counties.csv > data/nyt-us-counties.csv
	curl https://raw.githubusercontent.com/nytimes/covid-19-data/master/us-states.csv > data/nyt-us-states.csv
	curl https://raw.githubusercontent.com/nytimes/covid-19-data/master/us.csv > data/nyt-us.csv

.PHONY: build
