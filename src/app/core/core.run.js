(() => {
    'use strict';

    angular
        .module('app.core')
        .run(debugBlock)
        .run(apiBlock)
        .run(runBlock);

    /**
     * @function runBlock
     * @private
     * @memberof app.core
     * @description
     *
     * The `runBlock` triggers config and locale file loading, sets language of the app.
     */
    function runBlock($rootScope, $rootElement, $q, globalRegistry, reloadService, events, configService,
            gapiService, appInfo) {

        const promises = [
            configService.initialize(),
            gapiService.isReady
        ];

        // wait on the config and geoapi
        $q.all(promises)
            .then(() => {
                readyDelay();
            })
            .catch(reason => {
                console.error('Everything broke');
                console.error(reason);
            });

        // to prevent FOUC (flash of unstyled content) need to load translation
        // files with config initialization if we know the language
        // $rootScope.$on('$translateLoadingSuccess', data => console.log(data));
        $rootScope.$on('$translateLoadingSuccess', () => console.log(
            '$translateLoadingSuccess ->'));

        /********************/

        /**
         * Waits on bookmark to modify the config if needed
         *
         * @function readyDelay
         * @private
         */
        function readyDelay() {
            const waitAttr = $rootElement.attr('rv-wait');

            preLoadApiBlock();

            if (typeof waitAttr !== 'undefined') {
                reloadService.bookmarkBlocking = true;
                const deRegister = $rootScope.$on(events.rvBookmarkInit, () => {
                    $rootScope.$broadcast(events.rvReady);
                    deRegister(); // de-register `rvBookmarkInit` listener to prevent broadcasting `rvReady` in the future
                });
            } else {
                $rootScope.$broadcast(events.rvReady);
            }
        }

        /**
         * Allows API calls to be exposed before map creation
         *
         * @function preLoadApiBlock
         * @private
         */
        function preLoadApiBlock() {
            const preMapService = {
                initialBookmark,
                restoreSession,
                start
            };

            globalRegistry.getMap(appInfo.id)._registerPreLoadApi(preMapService);

            /******************/

            /**
             * Loads using a bookmark
             *
             * @function initialBookmark
             * @param {String} bookmark      bookmark containing viewer state
             */
            function initialBookmark(bookmark) {
                const storage = sessionStorage.getItem(appInfo.id);
                if (storage) {
                    sessionStorage.removeItem(appInfo.id);
                }

                reloadService.loadWithBookmark(bookmark, true);
            }

            /**
             * Loads using a bookmark from sessionStorage (if found) and a keyList
             *
             * @function restoreSession
             * @param {Array} keys      list of keys to load with
             */
            function restoreSession(keys) {
                const bookmark = sessionStorage.getItem(appInfo.id);

                if (bookmark) {
                    reloadService.loadWithExtraKeys(bookmark, keys);
                    sessionStorage.removeItem(appInfo.id);
                } else {
                    globalRegistry.getMap(appInfo.id).loadRcsLayers(keys);
                    start();
                }
            }

            /**
             * Bypasses the rv-wait block
             *
             * @function start
             */
            function start() {
                console.log('Bypassing rv-wait');
                reloadService.bookmarkBlocking = false;
                $rootScope.$broadcast(events.rvBookmarkInit);
            }

        }
    }

    /**
     * @function apiBlock
     * @private
     * @memberof app.core
     * @description
     *
     * `apiBlock` sets up language and RCS calls for the global API
     */
    function apiBlock($rootScope, globalRegistry, geoService, configService, events,
        LayerBlueprint, bookmarkService, gapiService, reloadService, appInfo) {

        const service = {
            setLanguage,
            loadRcsLayers,
            getBookmark,
            centerAndZoom,
            useBookmark,
            backToCart
        };

        // Attaches a promise to the appRegistry which resolves with apiService
        $rootScope.$on(events.rvApiReady, () => {
            globalRegistry.getMap(appInfo.id)._registerMap(service);
            console.log(appInfo.id + ' registered');
        });

        $rootScope.$on(events.rvApiHalt, () => {
            globalRegistry.getMap(appInfo.id)._deregisterMap();
        });

        /**********************/

        /**
         * Sets the translation language and reloads the map
         *
         * @memberof app.core
         * @function
         * @inner
         * @param {String}  lang    the language to switch to
         */
        function setLanguage(lang) {
            reloadService.loadNewLang(lang);
        }

        /**
         * Load RCS layers after the map has been instantiated
         *
         * @memberof app.core
         * @function
         * @inner
         * @param {Array}  keys  array of RCS keys (String) to be added
         */
        function loadRcsLayers(keys) {

            // trigger RCS web call, insert into config
            configService.rcsAddKeys(keys)
                .then(newLayerConfigs => {
                    // call layer register in geo module on those nodes
                    const layerBlueprints = newLayerConfigs.map(layerConfig => {
                        layerConfig.origin = 'rcs';
                        return new LayerBlueprint.service(layerConfig, geoService.epsgLookup);
                    });
                    geoService.constructLayers(layerBlueprints);
                });

        }

        /**
         * Stores the viewer state in sessionStorage and returns a list of rcs keys to pass to the mapCart.
         *
         * @returns {array}     List of RCS keys
         */
        function backToCart() {
            // get bookmark, throw bookmark into session storage
            const bm = bookmarkService.getBookmark();

            sessionStorage.setItem(appInfo.id, bm);

            // get list of layers, find layers with rcs creation
            // return array with layer keys
            const layerKeys = geoService.getRcsLayerIDs();
            return layerKeys;
        }

        /**
         * Retrieves a bookmark for the current state
         *
         * @function getBookmark
         * @returns {String}    The bookmark containing the state of the viewer
         */
        function getBookmark() {
            return bookmarkService.getBookmark();
        }

        /**
         * Updates the map using bookmark. If initial is set, will only be used if its the first call to be received.
         *
         * @function useBookmark
         * @param {String} bookmark     The bookmark containing the desired state of the viewer
         */
        function useBookmark(bookmark) {
            reloadService.loadWithBookmark(bookmark, false);
        }

        /**
         * Updates the extent of the map.
         *
         * @function centerAndZoom
         * @param {Array}  x                    The x coord to center on
         * @param {Number} y                    The y coord to center on
         * @param {Object} spatialReference     The spatial Reference for the coordinates
         * @param {Number} zoom                 The level to zoom to
         */
        function centerAndZoom(x, y, spatialReference, zoom) {
            const coords = gapiService.gapi.proj.localProjectPoint(
                                spatialReference, geoService.mapObject.spatialReference, { x: x, y: y }
                    );
            const zoomPoint = gapiService.gapi.proj.Point(coords.x, coords.y, geoService.mapObject.spatialReference);

            // separate zoom and center calls, calling centerAndZoom sets the map to an extent made up of NaN
            geoService.mapObject.setZoom(zoom);
            geoService.mapObject.centerAt(zoomPoint);
        }
    }

    /**
     * @function debugBlock
     * @private
     * @memberof app.core
     * @description
     *
     * Exposes inner services for debugging purposes
     */
    function debugBlock($rootElement, appInfo, geoService) {
        // store app id in a value
        appInfo.id = $rootElement.attr('id');

        // expose guts for debug purposes
        angular.extend(window.RV.debug[appInfo.id], {
            geoService
        });
    }
})();
