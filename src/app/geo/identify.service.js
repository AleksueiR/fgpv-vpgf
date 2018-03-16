import { MapClickEvent } from 'api/events';
import { IdentifyMode } from 'api/map';

/**
 * @module identifyService
 * @memberof app.geo
 *
 * @description
 * Generates handlers for feature identification on all layer types.
 */
angular.module('app.geo').factory('identifyService', identifyService);

function identifyService($q, configService, stateManager, events) {
    const service = {
        identify
    };

    let mApi = null;
    events.$on(events.rvApiMapAdded, (_, api) => (mApi = api));

    return service;

    /**
     * Handles global map clicks.  Currently configured to walk through all layer records
     * and trigger service side identify queries.
     * GeoApi is responsible for performing client side spatial queries on registered
     * feature layers or server side queries for everything else.
     *
     * @function identify
     * @param {Event} clickEvent ESRI map click event which is used to run identify function
     * @returns {Object} { details?: { data: Promise<any>[], isLoaded: Promise<boolean> }, requester?: { mapPoint: any } }
     */
    function identify(clickEvent) {
        console.log(clickEvent);

        const mapInstance = configService.getSync.map.instance;
        const opts = {
            clickEvent,
            map: mapInstance,
            geometry: clickEvent.mapPoint,
            width: mapInstance.width,
            height: mapInstance.height,
            mapExtent: mapInstance.extent
        };

        const identifyInstances = configService.getSync.map.layerRecords
            // TODO: can we expose identify on all layer record types and vet in geoapi for consistency
            .filter(layerRecord => typeof layerRecord.identify !== 'undefined')
            .map(layerRecord => layerRecord.identify(opts))
            // identify function returns undefined is the layer is cannot be queries because it's not visible or for some other reason
            .filter(identifyInstance => typeof identifyInstance.identifyResults !== 'undefined');

        const allIdentifyResults = [].concat(...identifyInstances.map(({ identifyResults }) => identifyResults));

        const mapClickEvent = new MapClickEvent(clickEvent);
        mApi._clickSubject.next(mapClickEvent);

        const allLoadingPromises = identifyInstances.map(({ identifyPromise, identifyResults }) => {
            // catch error on identify promises and store error messages to be shown in the details panel.
            const loadingPromise = identifyPromise.catch(error => {
                // add common error handling

                RV.logger.warn('identifyService', `Identify query failed with error`, error);

                identifyResults.forEach(identifyResult => {
                    // TODO: this outputs raw error message from the service
                    // we might want to replace it with more user-understandable messages
                    identifyResult.error = error.message;
                    identifyResult.isLoading = false;
                });
            });

            const infallibleLoadingPromise = makeInfalliblePromise(loadingPromise);

            infallibleLoadingPromise.then(() => {
                identifyResults.forEach(idResult => {
                    const featureList = idResult.data || [];
                    featureList.forEach(feat => {
                        mapClickEvent._featureSubject.next(feat);
                    });
                });
            });

            return infallibleLoadingPromise;
        });

        if (allIdentifyResults.length === 0) {
            return {};
        }

        const allLoadedPromise = $q.all(allLoadingPromises).then(() => {
            // push identify results into the API stream when everything is resolved
            // the subscribers can modify/add/remove the items returned by the results
            // if the items are removed from the `identifyResults[].data` array,
            // they will not be highlighted or shown in the details panel
            // mApi._identifySubject.next(allIdentifyResults);
            return true;
        });

        const details = {
            data: allIdentifyResults,
            isLoaded: allLoadedPromise
        };

        // store the mappoint in the requester so it's possible to show a marker if there is no feature to highlight
        const requester = {
            mapPoint: clickEvent.mapPoint
        };

        ////

        /*  const requester = {
            mapPoint: clickEvent.mapPoint
        }; */

        /* interface IdentifyPackage {
            requester: {
                mapPoint: MapPoint
            },
            requests: {
                requester: LayerInterface,
                results: Promise<{ name: string, data: any[], oid: string, symbology: any[] }[]>
            }[]
        } */

        const requests = identifyInstances.reduce((map, { identifyPromise, identifyResults }) => {
            const instanceRequests = identifyResults.map(r => ({
                requester: r.requester.proxy,
                results: identifyPromise.then(() => r.data)
            }));
            return map.concat(instanceRequests);
        }, []);

        mApi._identifySubject.next({
            requests,
            requester
        });

        ////

        /* RZ.mapInstances[0].identify.subscribe(event => {
            console.log('%c Parsing identify results as they resolve', 'background: #222; color: #bada55');
            const t0 = performance.now();

            event.requests.forEach((r, index) => r.results.then(data => console.log(index, r.requester.name, data, `resolved in ${(performance.now() - t0).toFixed(2)} milliseconds`)));
        });

        RZ.mapInstances[0].identify.subscribe(event => {
            const t0 = performance.now();
            Promise.all(event.requests.map(r => r.results)).then(allResults => {
                console.log('%c Waiting for all identify results to resolve first', 'background: #222; color: #bada55');
                const t1 = performance.now() - t0;
                allResults.forEach((data, index) => console.log(index, event.requests[index].requester.name, data, `resolved in ${t1.toFixed(2)} milliseconds`));

                // allResults.forEach(data => data.splice(1));
            });
        }); */

        // show details panel only when there is data and the idenityfMode is set to `Details`
        if (mApi.identifyMode === IdentifyMode.Details) {
            stateManager.toggleDisplayPanel('mainDetails', details, requester, 0);
        } else {
            return { details, requester };
        }

        /**
         * Modifies identify promises to always resolve, never reject.
         * Any errors caught will be added to the details data object.
         * Resolutions of these promises are for turning off loading indicator.
         *
         * @function makeInfalliblePromise
         * @private
         * @param  {Promise} promise [description]
         * @return {Promise} promise that doesn't reject
         */
        function makeInfalliblePromise(promise) {
            const modifiedPromise = $q(resolve => promise.then(() => resolve(true)).catch(() => resolve(true)));

            return modifiedPromise;
        }
    }
}
