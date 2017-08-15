const templateUrl = require('./details.html');

/**
 * @module rvDetails
 * @memberof app.ui
 * @restrict E
 * @description
 *
 * The `rvDetails` directive to display point data and wms query results.
 * Where are multiple data items, displays a selector list on the left side, letting the user to select the item.
 *
 */
angular
    .module('app.ui')
    .directive('rvDetails', rvDetails);

function rvDetails() {
    const directive = {
        restrict: 'E',
        templateUrl,
        scope: {},
        controller: Controller,
        controllerAs: 'self',
        bindToController: true
    };

    return directive;
}

function Controller($scope, $element, events, stateManager, mapService, detailService, SymbologyStack) {
    'ngInject';
    const self = this;


    const randomRegions = ["Toronto", "Huntsville", "Woodstock", "White River", "Sudbury", "Thunder Bay"];
    const tempType = ["Iron", "Wind", "Rain", "Body", "Work", "Road", "Food"];
    

    function getRand(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    self.randomRegion = getRand(randomRegions);
    self.tempType = getRand(tempType);
    self.lowTemp = Math.round(Math.random() * 30 * 10) / 10;
    self.highTemp = self.lowTemp + Math.round(Math.random() * 15 * 10) / 10;
    self.changeTemp = Math.round((self.highTemp - self.lowTemp) * 10) / 10;

    self.closeDetails = detailService.closeDetails;
    self.display = stateManager.display.details;
    self.selectItem = selectItem;
    self.expandPanel = detailService.expandPanel;

    self.getSectionNode = () =>
        $element.find('.rv-details');

    /**
     * Find and return a details item whose proxy object matches the proxy of the previously selected item.
     *
     * @private
     * @function  findPreviouslySelected
     * @param {Object} items data objects array
     * @return {Object}      selected item in details panel
     */
    function findPreviouslySelected(items) {
        // get selected item if there is a match
        return items.find(item =>
            item.requester.proxy === self.selectedLayerProxy);
    }

    /**
     * Changes the layer whose data is displayed.
     * @function selectItem
     * @param  {Object} item data object
     */
    function selectItem(item) {
        if (self.selectedItem === item) {
            // re-highlight features in this item
            // the previous highlight might have been cancelled by panning, and the user can re-highlihght feature by clicking on the selected layer again
            $scope.$broadcast(events.rvHighlightDetailsItem, item);

            // this item is already selected; exiting;
            return;
        }

        self.selectedItem = item;
        self.selectedLayerProxy = null;

        self.display.selectedItem = self.selectedItem;
    }

    let deRegisterFirstResultWatch = angular.noop;

    $scope.$watch('self.display.data', (newValue, oldValue) => {
        deRegisterFirstResultWatch();

        // if multiple points added to the details panel ...
        if (newValue && newValue.length > 0) {

            selectItem(newValue[0]);

        } else if (oldValue) {
            selectItem(null);
        }

        /**
         * Checks if at least one fo the item received results.
         *
         * @function _waitForFirstResult
         * @private
         * @return {Boolean} `true` if at least one item received results
         */
        function _waitForFirstResult() {
            return self.display.data.find(item => item.data.length > 0);
        }
    });
}
