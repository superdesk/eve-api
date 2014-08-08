# ensure that src/module.js is at the beginning
dist/eve-api.js: src/module.js src/api-service.js src/http-endpoint-factory.js src/url-resolver-service.js
	cat $^ > $@
