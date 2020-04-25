build:
	node tools/build.js

convert:
	rm -rf build
	mkdir build
	mkdir build/data
	node tools/convert-nyt-us-states.js
	node tools/convert-nyt-us.js
	node tools/convert-us.js
#	node tools/convert-spain.js
#	node tools/convert-switzerland.js

refresh:
	curl https://raw.githubusercontent.com/nytimes/covid-19-data/master/us-counties.csv > data/nyt-us-counties.csv
	curl https://raw.githubusercontent.com/nytimes/covid-19-data/master/us-states.csv > data/nyt-us-states.csv
	curl https://raw.githubusercontent.com/nytimes/covid-19-data/master/us.csv > data/nyt-us.csv
	curl https://usafactsstatic.blob.core.windows.net/public/data/covid-19/covid_confirmed_usafacts.csv > data/covid_confirmed_usafacts.csv
	curl https://usafactsstatic.blob.core.windows.net/public/data/covid-19/covid_deaths_usafacts.csv > data/covid_deaths_usafacts.csv
	curl https://covid19.isciii.es/resources/serie_historica_acumulados.csv > data/covid_spain.csv
	curl https://fingertips.phe.org.uk/documents/Historic%20COVID-19%20Dashboard%20Data.xlsx > data/covid_uk.xlsx

.PHONY: build
