build:
	node tools/build.js

refresh:
	curl https://usafactsstatic.blob.core.windows.net/public/data/covid-19/covid_confirmed_usafacts.csv > data/covid_confirmed_usafacts.csv
	curl https://usafactsstatic.blob.core.windows.net/public/data/covid-19/covid_deaths_usafacts.csv > data/covid_deaths_usafacts.csv

.PHONY: build
