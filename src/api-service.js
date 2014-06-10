    'use strict';

    /**
     * Api layer provider
     */
angular
  .module('eveApi')
  .provider('api', function() {
        var apis = {};

        /**
         * Register an api
         */
        this.api = function(name, config) {
            apis[name] = config;
            return this;
        };

        this.$get = apiServiceFactory;

        apiServiceFactory.$inject = ['$injector',
                                     'MockEndpoint',
                                     'HttpEndpoint'];
        function apiServiceFactory($injector, MockEndpoint, HttpEndpoint) {

            var endpoints = {
                'mock': MockEndpoint,
                'http': HttpEndpoint
            };

            return _.mapValues(apis, function(config, apiName) {
                var service = config.service || _.noop;
                service.prototype = new endpoints[config.type](apiName, config.backend);
                return $injector.instantiate(service, {resource: service.prototype});
            });
        }
    });
