build:
	node tools/build.js

refresh:
	curl https://usafactsstatic.blob.core.windows.net/public/data/covid-19/covid_confirmed_usafacts.csv > data/covid_confirmed_usafacts.csv
	curl https://usafactsstatic.blob.core.windows.net/public/data/covid-19/covid_deaths_usafacts.csv > data/covid_deaths_usafacts.csv
	curl https://covid19.isciii.es/resources/serie_historica_acumulados.csv > data/covid_spain.csv
	curl https://fingertips.phe.org.uk/documents/Historic%20COVID-19%20Dashboard%20Data.xlsx > data/covid_uk.xlsx

.PHONY: build
