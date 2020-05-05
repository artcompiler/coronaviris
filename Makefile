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
	node tools/convert-usafacts-us-counties.js
	node tools/convert-spain.js
#	node tools/convert-switzerland.js

refresh:
	curl https://covid.ourworldindata.org/data/owid-covid-data.csv > data/owid-world.csv
	curl https://raw.githubusercontent.com/nytimes/covid-19-data/master/us-counties.csv > data/nyt-us-counties.csv
	curl https://raw.githubusercontent.com/nytimes/covid-19-data/master/us-states.csv > data/nyt-us-states.csv
	curl https://raw.githubusercontent.com/nytimes/covid-19-data/master/us.csv > data/nyt-us.csv
	curl https://usafactsstatic.blob.core.windows.net/public/data/covid-19/covid_confirmed_usafacts.csv > data/usafacts-us-counties-cases.csv
	curl https://usafactsstatic.blob.core.windows.net/public/data/covid-19/covid_deaths_usafacts.csv > data/usafacts-us-counties-deaths.csv
	curl https://covid19.isciii.es/resources/serie_historica_acumulados.csv > data/isciii-spain.csv

.PHONY: build
