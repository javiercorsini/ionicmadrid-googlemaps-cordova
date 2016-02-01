angular.module('MapServices', [])

    .factory('MapManager', function($q, $timeout, $ionicPlatform, $interval) {

        var map;
        var mapManager = {};

        var mapData = {
            origin: {
                address: '',
                position: {latitude: 40.4530582, longitude: -3.6905332}
            },
            destination: false,
            zoom: 16,
            isCameraMoving: true
        };

        // Use to signal when the map is ready
        var mapReady = false;

        // Stores functionality to be run after the map is ready
        var mapReadyCallbacks = [];

        /**
         * @ngdoc method
         * @name setUserLocation
         * @methodOf MapServices.service:MapManager
         * @description
         * Waits until the map is ready and tries to set the center of the map
         * in the users location
         */
        mapManager.setUserLocation = function() {

            var deferred = $q.defer();

            /** Get the user's location when the platform is ready and
             * update the map accordingly */
            mapManager.getMyLocation(function(error, coords) {

                if (error || !coords) {
                    deferred.reject();
                    return;
                }

                // Set the map to the user's coordinates and update the address bar
                mapData.zoom = 17;
                mapManager.setOrigin(coords, true);
                deferred.resolve();
            });

            return deferred.promise;
        };

        /**
         * @ngdoc method
         * @name getMapData
         * @methodOf MapServices.service:MapManager
         * @description
         * Returns the map data object needed to update the elements
         * above the map screen
         *
         * @returns {object} the map data
         * <pre>
         * {
         *      address: 'Finding your location...',
         *      center: { latitude: 39.54732, longitude: 2.73061 },
         *      zoom: 14
         * }
         * </pre>
         */
        mapManager.getMapData = function() {
            return mapData;
        };

        /**
         * @ngdoc method
         * @name initMap
         * @methodOf MapServices.service:MapManager
         * @description
         * Initializes the Google Map once the device is ready
         * @param {string} mapDivId the id of the map div
         */
        mapManager.initMap = function(mapDivId) {

            $ionicPlatform.ready(function() {
                if (window.cordova) {
                    map = plugin.google.maps.Map.getMap(document.getElementById(mapDivId));
                    map.on(plugin.google.maps.event.MAP_READY, function() {

                        map.setMyLocationEnabled(false);
                        map.setCompassEnabled(true);
                        map.setBackgroundColor('white');
                        map.setDebuggable(true);

                        mapManager.setClickable(false); // The map is disabled by default
                        mapManager.clear(); // Clear all markup just in case
                        map.setPadding(0, 0, 0, 0);

                        map.animateCamera({
                            target: getLatLng(mapData.origin.position),
                            zoom: mapData.zoom
                        });

                        // Check if there are any callbacks waiting for the map to be ready
                        mapReady = true;
                        startIntervalsToDetectCameraMoving();
                        executeOnMapReadyCallbacks();
                    });
                }
            });
        };

        /**
         * @ngdoc method
         * @name onMapReady
         * @methodOf MapServices.service:MapManager
         * @description
         * It executes the given callback function when the map is initialized and ready
         * @param {function} cb the function to be called when the map is ready
         */
        mapManager.onMapReady = function(cb) {

            if (mapReady) {
                cb();
                return;
            }

            mapReadyCallbacks.push(cb);
        };

        /**
         * @ngdoc method
         * @name executeOnMapReadyCallbacks
         * @methodOf MapServices.service:MapManager
         * @private
         * @description
         * Executes callbacks waiting for the map to be ready and removes them from the internal array
         */
        function executeOnMapReadyCallbacks() {
            while (mapReadyCallbacks.length !== 0) {
                mapReadyCallbacks.shift()();
            }
        }

        /**
         * @ngdoc method
         * @name setClickable
         * @methodOf MapServices.service:MapManager
         * @description
         * Enables or disables the map
         * @param {boolean} clickable enable or disable the map
         */
        mapManager.setClickable = function(clickable) {
            map.setClickable(clickable);
        };

        /**
         * @ngdoc method
         * @name isDom
         * @methodOf MapServices.service:MapManager
         * @private
         * @description
         * Checks if a given element is a DOM element
         * @param {object} element the div element to be checked
         * @returns {boolean} true if the element is a DOM element and false otherwise
         */
        function isDom(element) {
            return !!element && typeof element === 'object' && 'getBoundingClientRect' in element;
        }

        /**
         * @ngdoc method
         * @name setDiv
         * @methodOf MapServices.service:MapManager
         * @description
         * Associates the map to the given div
         * @param {string} newMapDivId the id to associate the map to
         */
        mapManager.setDiv = function(newMapDivId) {

            var div = document.getElementById(newMapDivId);

            if (!isDom(div)) {
                return map;
            }

            map.setDiv(div);

            /**
             * If we are changing the div, the camera may not point to the
             * current center. We have to force it
             */
            mapManager.returnCameraToOrigin();
            return map;
        };

        /**
         * @ngdoc method
         * @name addListener
         * @methodOf MapServices.service:MapManager
         * @description
         * Attaches a new listener function to a given event. Example event types:
         *
         * <pre>
         *     plugin.google.maps.event.MAP_READY
         *     plugin.google.maps.event.CAMERA_CHANGE
         * </pre>
         *
         * @param {object} event a google map object
         * @param {function} listener the callback function to be called on the given event
         */
        mapManager.addListener = function(event, listener) {
            map.on(event, listener);
        };

        /**
         * @ngdoc method
         * @name setCenter
         * @methodOf MapServices.service:MapManager
         * @description
         * Sets the center of the map to the given coordinates and changes the map address
         * stored in the mapData object
         *
         * @param {object} coords the new coordinates
         * @param {number} coords.latitude the latitude of the coordinate
         * @param {number} coords.longitude the longitude of the coordinate
         * @param {boolean} updateMap Updates the map location
         * @param {string} [address] the address associated with the coordinates
         * @param {string} [noAnimate] if the camera should show an animation
         */
        mapManager.setOrigin = function(coords, updateMap, address, noAnimate) {

            if (updateMap) {

                if (noAnimate) {
                    map.moveCamera({
                        target: getLatLng(coords),
                        zoom: mapData.zoom
                    });
                } else {
                    map.animateCamera({
                        target: getLatLng(coords),
                        zoom: mapData.zoom
                    });
                }
            }

            mapData.origin.position = coords;
        };

        /**
         * @ngdoc method
         * @name getCenter
         * @methodOf MapServices.service:MapManager
         * @description
         * Returns the center of the map
         *
         * @returns {object} the center of the map
         * <pre>
         * {
         *      latitude: 39.54732,
         *      longitude: 2.73061
         * }
         * </pre>
         */
        mapManager.getCenter = function() {
            return mapData.origin.position;
        };

        /**
         * @ngdoc method
         * @name getLatLng
         * @methodOf MapServices.service:MapManager
         * @private
         * @description
         * Utility function to get the coordinates as a plugin.google.maps.LatLng
         * object
         *
         * @param {object} coords the new coordinates
         * @param {number} coords.latitude the latitude of the coordinate
         * @param {number} coords.longitude the longitude of the coordinate
         * @returns {plugin.google.maps.LatLng} The coordinates as a GoogleMaps LatLng object
         */
        function getLatLng(coords) {
            return new plugin.google.maps.LatLng(coords.latitude, coords.longitude);
        }

        /**
         * @ngdoc method
         * @name getMyLocation
         * @methodOf MapServices.service:MapManager
         * @description
         * Gets the device's location and returns it to the callback. The
         * returned object has the following format:
         * <pre>
         *     {
         *        latitude: 30,
         *        longitude: 30
         *     }
         * </pre>
         * @param {function} cb the standard callback with a format function(error, coords)
         */
        mapManager.getMyLocation = function(cb) {

            var opts = {enableHighAccuracy: true};

            map.getMyLocation(opts, function(result) {

                var coords = {latitude: result.latLng.lat, longitude: result.latLng.lng};

                cb(null, coords);
            }, function(errorMsg) {

                cb(errorMsg);
            });
        };

        var markers = [];
        var markerConfirm;

        /**
         * @ngdoc method
         * @name clearMarkers
         * @methodOf MapServices.service:MapManager
         * @description
         * Removes all markers from the map
         */
        mapManager.clearMarkers = function() {
            while (markers.length !== 0) {
                markers.shift().remove();
            }

            if (markerConfirm) {
                markerConfirm.remove();
                markerConfirm = null;
            }
        };

        /**
         * @ngdoc method
         * @name getMarkersCount
         * @methodOf MapServices.service:MapManager
         * @description
         * Returns the number of active markers.
         * @return {number} the number of markers
         */
        mapManager.getMarkersCount = function() {
            return markers.length;
        };

        /**
         * @ngdoc method
         * @name clear
         * @methodOf MapServices.service:MapManager
         * @description
         * Clears all data within the map
         */
        mapManager.clear = function() {
            map.clear();
            markers = [];
            markerConfirm = null;
            mapManager.clearPolyline();
        };

        /**
         * @ngdoc method
         * @name setMarker
         * @methodOf MapServices.service:MapManager
         * @description
         * Set's a marker within the map in the given position and with the supplier logo
         * @param {Object} position the coordinates of the marker
         * @param {number} position.latitude the latitude of the marker
         * @param {number} position.longitude the longitude of the marker
         * @param {string} iconUrl the URL of the supplier logo
         */
        mapManager.setMarker = function(position, iconUrl) {

            var deferred = $q.defer();

            //createMapIcon(iconUrl).then(function(iconDataUrl) {

                map.addMarker({
                    position: getLatLng(position),
                    icon: {
                        /* If instead of using a data URL image we used a local image, we would
                         * need to add www/ before the icons path. Plugin google maps needs the
                         * www before the relative route (don't ask me why)
                         * url: 'www/' + iconPath */
                        //url: iconDataUrl,
                        url: 'www/' + iconUrl,
                        size: {
                            width: 47,
                            height: 47
                        }
                    }
                }, function(marker) {
                    markers.push(marker);
                    deferred.resolve(marker);
                });
            //});

            return deferred.promise;
        };

        /**
         * @ngdoc method
         * @name createMapIcon
         * @methodOf MapServices.service:MapManager
         * @private
         * @description
         * Creates an icon via URL data from the given supplier Logo
         * and the internal image used to create the marker.
         * Through a promise, it returns the dataURL
         * @param {string} supplierLogo the URL to the supplier's logo
         * @return {Object} a promise that resolves in the dataURL
         */
        function createMapIcon(supplierLogo) {

            var deferred = $q.defer();

            var canvas = document.createElement('canvas');
            canvas.width = 27;
            canvas.height = 27;
            var ctx = canvas.getContext('2d');

            var img1 = new Image();
            var img2 = new Image();

            img1.onload = function() {
                ctx.drawImage(img1, 0, 0, 27, 27);
                img2.onload = function() {
                    ctx.drawImage(img2, 5.2, 2.2, 16.5, 17.1);
                    deferred.resolve(canvas.toDataURL());
                };

                img2.src = supplierLogo;
            };

            img1.src = 'img/icons/taxi-pin.png';

            return deferred.promise;
        }

        /**
         * @ngdoc method
         * @name getCameraPosition
         * @methodOf MapServices.service:MapManager
         * @description
         * Retrieves the position of the native map's camera
         * @returns {Object} returns a promise. The promise returns the
         * camera position when resolved. The camera position is an
         * object with the following format
         * <pre>
         *     {
         *        lat: 1.333,
         *        lng: 30.33
         *     }
         * </pre>
         */
        mapManager.getCameraPosition = function() {
            var deferred = $q.defer();
            if (map) {
                map.getCameraPosition(function(camera) {
                    deferred.resolve(camera.target);
                });
            } else {
                deferred.reject();
            }

            return deferred.promise;
        };

        /**
         * @ngdoc method
         * @name setZoom
         * @methodOf MapServices.service:MapManager
         * @param {number} zoom the new zoom of the map
         * @description
         * Changes the map zoom
         */
        mapManager.setZoom = function(zoom) {

            map.setZoom(zoom);
            mapData.zoom = zoom;
        };

        /**
         * @ngdoc method
         * @name refreshLayout
         * @methodOf MapServices.service:MapManager
         * @description
         * Refreshes the map layout
         */
        mapManager.refreshLayout = function() {

            if (!map) { return; }

            $timeout(function() {
                map.refreshLayout();
            }, 1);
        };

        var mapPolyline;

        /**
         * @ngdoc method
         * @name clearPolyline
         * @methodOf MapServices.service:MapManager
         * @description
         * Removes polyline from the map
         */
        mapManager.clearPolyline = function() {
            if (mapPolyline) {
                mapPolyline.remove();
                mapPolyline = null;
            }
        };
        /**
         * @ngdoc method
         * @name getZoom
         * @methodOf MapServices.service:MapManager
         * @description
         * Returns the current zoom of the map
         * @return {Promise} Returns the promise. Once resolved it returns the zoom as the
         * only parameter
         */
        mapManager.getZoom = function() {

            var deferred = $q.defer();
            map.getCameraPosition(function(camera) {
                deferred.resolve(camera.zoom);
            });

            return deferred.promise;
        };

        /**
         * @ngdoc method
         * @name moveCamera
         * @methodOf MapServices.service:MapManager
         * @param {Object} center the coordinates of the new center for the camera
         * @param {number} center.latitude the latitude of the new center
         * @param {number} center.longitude the longitude of the new center
         * @param {number} [zoom] the zoom of the camera
         * @description
         * Moves the center of the camera to the given center coordinates
         */
        mapManager.moveCamera = function(center, zoom) {

            if (zoom) {
                map.moveCamera({target: getLatLng(center), zoom: zoom});
                return;
            }

            mapManager.getZoom().then(function(currentZoom) {
                map.moveCamera({target: getLatLng(center), zoom: currentZoom});
            });
        };

        /**
         * @ngdoc method
         * @name setOriginToCameraCenter
         * @methodOf MapServices.service:MapManager
         * @description
         * Sets the map origin and address to the current camera center
         * @returns {Promise} returns a promise. It does not return anything when resolved.
         */
        mapManager.setOriginToCameraCenter = function() {
            var deferred = $q.defer();
            map.getCameraPosition(function(camera) {
                mapManager.setOrigin({latitude: camera.target.lat, longitude: camera.target.lng}, false, false);
                deferred.resolve();
            });

            return deferred.promise;
        };

        /**
         * @ngdoc method
         * @name returnCameraToOrigin
         * @methodOf MapServices.service:MapManager
         * @description
         * Moves the map camera to the position set by origin
         */
        mapManager.returnCameraToOrigin = function() {
            map.moveCamera({
                target: getLatLng(mapData.origin.position),
                zoom: mapData.zoom
            });
        };

        var position = { lat: -1, lng: -1};
        var intervalToHide;
        var intervalToShow;

        /**
         * @ngdoc method
         * @name startIntervalsToDetectCameraMoving
         * @methodOf MapServices.service:MapManager
         * @private
         * @description
         * Fix to be able to hide the map icon when the user is moving the map.
         * It checks constantly if the camera has moved to change the flag
         * that controls the visibility of the controls in the map
         */
        function startIntervalsToDetectCameraMoving() {

            if (!angular.isDefined(intervalToHide)) {
                intervalToHide = $interval(setCameraIsMovingWhenCameraChanges, 200, 0);
            }
        }

        /**
         * @ngdoc method
         * @name setCameraIsMovingWhenCameraChanges
         * @methodOf MapServices.service:MapManager
         * @private
         * @description
         * Changes the dragging property to true if the map camera has moved
         * and starts the interval to get the property back to false
         * if the camera stops
         */
        function setCameraIsMovingWhenCameraChanges() {

            mapManager.getCameraPosition().then(function(cameraPosition) {

                if (position.lat !== cameraPosition.lat ||
                    position.lng !== cameraPosition.lng) {

                    mapData.isCameraMoving = true;
                    position = cameraPosition;

                    /* As soon as dragging is set to true, a new timer is created
                     * to change it back to false if the camera is not moving */
                    if (angular.isDefined(intervalToShow)) {
                        $interval.cancel(intervalToShow);
                    }

                    intervalToShow = $interval(setCameraIsNotMovingWhenCameraStops, 500, 0);
                }
            });
        }

        /**
         * @ngdoc method
         * @name setCameraIsNotMovingWhenCameraStops
         * @methodOf MapServices.service:MapManager
         * @private
         * @description
         * Changes the dragging property to false if the map camera has stopped
         * moving and changes the Map Origin address to the new position once
         * that happens
         */
        function setCameraIsNotMovingWhenCameraStops() {

            mapManager.getCameraPosition().then(function(cameraPosition) {
                if (position.lat === cameraPosition.lat &&
                    position.lng === cameraPosition.lng) {
                    mapData.isCameraMoving = false;
                } else {
                    position = cameraPosition;
                }
            });
        }

        mapManager.setVisible = function(visible) {
            map.setVisible(visible);
        };

        var imageSrcData = false;
        mapManager.setImage = function(img) {

            if (ionic.Platform.isAndroid()) { return $q.resolve(); }

            var deferred = $q.defer();
            if (img) {

                map.toDataURL(function(imageData) {
                    var image = document.getElementById('pepe');
                    image.src = imageData;
                    imageSrcData = imageData;
                    image.onload = function() {
                        deferred.resolve();
                        document.getElementById('itt-map-img').style.opacity = 1;
                        mapManager.setVisible(false);
                    };
                });
            } else {
                mapManager.setVisible(true);
                $timeout(function() {
                    deferred.resolve();
                    document.getElementById('itt-map-img').style.opacity = 0;
                    imageSrcData = false;
                }, 1);
            }

            return deferred.promise;
        };

        mapManager.restoreImage = function() {

            if (ionic.Platform.isAndroid()) { return; }

            if (imageSrcData) {
                var image = document.getElementById('pepe');
                image.style.backgroundColor = 'white';
            }
        };

        return mapManager;
    });
