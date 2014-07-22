angular.module('eveApi', ['ng']);
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
//define(['lodash'], function(_) {
    'use strict';

    /**
     * Mock endpoint
     */
angular
    .module('eveApi')
    .factory('MockEndpoint', ['$q', function($q) {

        function MockCursor(data) {
            this.total = data.length;
            this._items = data;
            this.collection = data;
        }

        /**
         * Mock API endpoint
         */
        function MockEndpoint(name, config) {
            this.name = name;
            this.data = _.create(config.data);
            this.url = config.url || null;
        }

        /**
         * Select items matching given criteria
         *
         * @param {Object} criteria
         * @returns {Promise}
         */
        MockEndpoint.prototype.query = function(criteria) {
            var matches = _.filter(this.data, criteria);
            return $q.when(new MockCursor(matches));
        };

        /**
         * Find item by given id
         *
         * @param {string} id
         * @returns {Promise}
         */
        MockEndpoint.prototype.find = function(id) {
            var item = _.find(this.data, {_id: id});
            return item ? $q.when(item) : $q.reject(item);
        };

        /**
         * Save item
         *
         * @param {Object} item
         * @param {Object} diff
         * @returns {Promise}
         */
        MockEndpoint.prototype.save = function(item, diff) {

            _.extend(item, diff);

            if (!item._id) {
                item._id = _.max(_.pluck(this.data, '_id')) + 1;
                this.data.push(item);
            }

            return $q.when(item);
        };

        /**
         * Remove an item
         *
         * @param {Object} item
         * @returns {Promise}
         */
        MockEndpoint.prototype.remove = function(item) {
            _.remove(this.data, item);
            return $q.when(item);
        };

        /**
         * Get url - there is no url, it is here to match http api endpoint
         *
         * @returns {Promise}
         */
        MockEndpoint.prototype.getUrl = function() {
            return $q.when(this.url);
        };

        return MockEndpoint;
}]);
//define(['lodash'], function(_) {
    'use strict';

    /**
     * Http endpoint factory
     */
angular
  .module('eveApi')
  .factory('HttpEndpoint', ['$http', '$q', 'urls', function($http, $q, urls) {

        /**
         * Get url for given resource
         *
         * @param {Object} resource
         * @returns {Promise}
         */
        function getUrl(resource) {
            return urls.resource(resource.rel);
        }

        /**
         * Get headers for given resource
         *
         * @param {Object} resource
         * @param {Object} item
         * @returns {Object}
         */
        function getHeaders(resource, item) {
            var headers = _.extend({}, resource.config.headers || {});
            if (item && item._etag) {
                headers['If-Match'] = item._etag;
            }
            return headers;
        }

        /**
         * Wrap $http call
         *
         * @param {Object} config
         * @returns {Promise}
         */
        function http(config) {
            return $q.when(config.url)
                .then(function(url) {
                    config.url = url;
                    return $http(config);
                })
                .then(function(response) {
                    if (response.status >= 200 && response.status < 300 &&
                    (!response.data || !response.data._status || response.data._status !== 'ERR')) {
                        return response;
                    } else {
                        return $q.reject(response);
                    }
                });
        }

        /**
         * Http Endpoint
         */
        function HttpEndpoint(name, config) {
            this.name = name;
            this.config = config;
            this.rel = config.rel;
        }

        /**
         * Get entity by url
         *
         * @param {string} url
         * @returns {Promise}
         */
        HttpEndpoint.prototype.getByUrl = function(url) {
            return http({
                method: 'GET',
                url: urls.item(url)
            }).then(function(response) {
                return response.data;
            });
        };

        /**
         * Get entity by given id
         *
         * @param {string} id
         * @returns {Promise}
         */
        HttpEndpoint.prototype.getById = function(id, params) {
            return getUrl(this).then(_.bind(function(resourceUrl) {
                var url = resourceUrl.replace(/\/+$/, '') + '/' + id;
                return http({
                    method: 'GET',
                    url: url,
                    params: params
                }).then(function(response) {
                    return response.data;
                });
            }, this));
        };

        /**
         * Resource query method
         *
         * @param {Object} params
         */
        HttpEndpoint.prototype.query = function(params) {
            return http({
                method: 'GET',
                params: params,
                url: getUrl(this),
                headers: getHeaders(this)
            }).then(function(response) {
                return response.data;
            });
        };

        /**
         * Update item
         *
         * @param {Object} item
         * @param {Object} diff
         * @returns {Promise}
         */
        HttpEndpoint.prototype.update = function(item, diff) {
            if (diff == null) {
              diff = _.omit(item, [
                '_links',
                '_id',
                '_etag',
                '_created',
                '_updated',
                '_status'
              ]);
            }
            var url = item._links.self.href;
            return http({
                method: 'PATCH',
                url: urls.item(url),
                data: diff,
                headers: getHeaders(this, item)
            }).then(function(response) {
                _.extend(item, response.data);
                return item;
            });
        };

        /**
         * Create new item
         *
         * @param {Object} itemData
         * @returns {Promise}
         */
        HttpEndpoint.prototype.create = function(itemData) {
            return http({
                method: 'POST',
                url: getUrl(this),
                data: itemData,
                headers: getHeaders(this)
            }).then(function(response) {
                _.extend(itemData, response.data);
                return itemData;
            });
        };

        /**
         * Save item
         *
         * @param {Object} item
         * @param {Object} diff
         * @returns {Promise}
         */
        HttpEndpoint.prototype.save = function(item, diff) {
            return item._id ? this.update(item, diff) : this.create(_.extend(item, diff));
        };

        /**
         * Replace item
         *
         * @param {Object} dest
         * @param {Object} item
         * @returns {Promise}
         */
        HttpEndpoint.prototype.replace = function(dest, item) {
            return http({
                method: 'PUT',
                url: urls.item(dest),
                data: item,
                headers: getHeaders(this, item)
            }).then(function(response) {
                _.extend(item, response.data);
                return item;
            });
        };

        /**
         * Remove item
         *
         * @param {Object} item
         * @returns {Promise}
         */
        HttpEndpoint.prototype.remove = function(item) {
            return http({
                method: 'DELETE',
                url: urls.item(item._links.self.href),
                headers: getHeaders(this, item)
            }).then(null, function(response) {
                return response.status === 404 ? $q.when(response) : $q.reject(response);
            });
        };

        /**
         * Get resource url
         *
         * @returns {Promise}
         */
        HttpEndpoint.prototype.getUrl = function() {
            return getUrl(this);
        };

        /**
         * Get headers
         *
         * @return {Object}
         */
        HttpEndpoint.prototype.getHeaders = function() {
            return getHeaders(this) || {};
        };

        return HttpEndpoint;

    }]);
//});
    'use strict';

angular
  .module('eveApi')
  .service('urls', ['$http', '$q', 'config', function($http, $q, config) {

        var links;

        /**
         * Get url for given resource
         *
         * @param {String} resource
         * @returns Promise
         */
        this.resource = function(resource) {
            return getResourceLinks().then(function() {
                return links[resource] ? links[resource] : $q.reject(resource);
            });
        };

        /**
         * Get server url for given item
         *
         * @param {String} item
         * @returns {String}
         */
        this.item = function(item) {
            return item; // noop - items should have full urls now
        };

        /**
         * Get resource links via root url
         *
         * @returns {Promise}
         */
        function getResourceLinks() {

            if (links != null) {
                return $q.when(links);
            }

            return $http({
                method: 'GET',
                url: config.server.url
            }).then(function(response) {
                links = {};

                if (response.status === 200) {
                    _.each(response.data._links.child, function(link) {
                        links[link.title] = link.href;
                    });
                } else {
                    $q.reject(response);
                }

                return links;
            });
        }
  }]);
