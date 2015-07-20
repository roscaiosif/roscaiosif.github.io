jQuery(function($) {
    //
    //http://www.smartredfox.com/plugins/map-list-pro/
    //https://github.com/knockout/knockout/wiki/Asynchronous-Dependent-Observables

    //Variables for google API and ko's viewmodel
    "use strict";
    var mapCanvas = $('#map-canvas');
    var mapWidth = $('#map-canvas').width();
    var mapHeight = $('#map-canvas').height();
    var widthBreak = 680;
    var heightBreak = 400;
    var latM = 45.4960301;
    var lngM = -73.5789544;
    var montreal = new google.maps.LatLng(latM, lngM);
    var mapOptions = {
        zoom: 17,
        center: montreal,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
    };

    //Create the map
    var map = new google.maps.Map(mapCanvas[0], mapOptions);

    //Keep the map centered on resize
    google.maps.event.addDomListener(window, 'resize', function() {
        google.maps.event.trigger(map, 'resize');
        map.setCenter(montreal);
    });
    //Street view
    var panorama = map.getStreetView();

    //info windows
    //both for data and viewModel
    var infowindow = new google.maps.InfoWindow();

    var errorwindow = new google.maps.InfoWindow();

    //Marker for the "errorwindow"
    var centerMarker = new google.maps.Marker({
        map: map,
        position: montreal,
    });
    centerMarker.setVisible(false);

    var showErrorWindow = function(error) {
        $("#error-message").html(error);
        errorwindow.setContent($("#error-window").html());
        errorwindow.open(map, centerMarker);
        infowindow.close();
    };

    var showInfoWindow = function(venue) {
        var marker = venue.mapMarker;
        VM.crtVenue(venue);
        var imgWrapper = $("#img-wrapper");
        //Handle lost internet connection for the picture
        $("#info-window").find("img").on('load', function() {
            if (imgWrapper.hasClass('hide')) {
                imgWrapper.removeClass('hide');
            }
            infowindow.setContent($("#info-window").html());
        }).on('error', function() {
            imgWrapper.addClass('hide');
            $("#img-error").html('<h3>The Internet connetion was lost...</h3>');
        });
        //show the infowindow close the center area
        map.panTo(marker.getPosition());
        if (mapWidth < widthBreak) {
            map.panBy(0, -100);
        } else {
            map.panBy(0, -50);
        }
        //show only at first-time click
        if ($('#btn-search-filter').hasClass('hide') && (mapWidth < widthBreak)) {
            showSearchFilterButton();
        }
        //if the display is really crowded hide the list
        if ($('#btn-list').hasClass('hide') && (mapHeight < heightBreak)) {
            showListButton();
        }
        infowindow.open(map, marker);
    };

    var showSearchFilterButton = function() {
        $("#search-filter").addClass('hide');
        $("#btn-search-filter").removeClass('hide');
    };
    var showListButton = function() {
        $("#list-wrapper").addClass('hide').css('height', 0);
        $("#map-wrapper").css('height', '100%');
        $("#btn-list").removeClass('hide');
    };

    //used only to initialize the viewModel or there are no photos
    var emptyPhoto = {
        prefix: 'images/dist/foursquare-wordmark.png',
        suffix: '',
        width: 0,
        height: 0
    };

    //gets the necessary data to fill up the view Model
    function getData() {
        //URL for the FourSquare explore venues request
        var searchFor = 'food';
        var searchRadius = '200'; //meters
        var client_id = "JI2X04M51STQLOUGVX0SWEOOSOOSHB2BEMZ0QTPM02TMJGGX";
        var client_secret = "4W4IRQJ10E0HKFLK4TFX3KZ4Q25DHQMFKH0IQEYFRG3XDQXQ";
        var foursquareExplore = "https://api.foursquare.com/v2/venues/explore?client_id=";
        foursquareExplore += client_id + "&client_secret=";
        foursquareExplore += client_secret + "&v=20150704&ll=";
        foursquareExplore += latM + ",";
        foursquareExplore += lngM + "&radius=";
        foursquareExplore += searchRadius + "&section=";
        foursquareExplore += searchFor + "&limit=50";

        //ajax for details (photos) for the venues
        var ajaxFoursquarePhotos = function(venue) {
            function addPhoto(item) {
                var photo = {};
                photo.prefix = item.prefix;
                photo.suffix = item.suffix;
                photo.width = item.width;
                photo.height = item.height;
                venue.photos.push(photo);
            }
            var photos = "https://api.foursquare.com/v2/venues/";
            photos += venue.id + "/photos?client_id=";
            photos += client_id + "&client_secret=";
            photos += client_secret + "&v=20150704";
            $.ajax({
                url: photos,
                success: function(results) {
                    //number of photos
                    var count = results.response.photos.count;
                    //max 10 photos
                    count = count < 10 ? count : 10;
                    venue.photoCount = count;
                    if (count > 0) {
                        var result = results.response.photos.items;
                        for (var i = 0; i < count; i++) {
                            addPhoto(result[i]);
                        }
                    } else {
                        venue.photos.push(emptyPhoto);
                    }
                },
                error: function(xhr) {
                    var responseText = $.parseJSON(xhr.responseText);
                    successDetailData = false;
                    showErrorWindow('Server response: <em>' + responseText.meta.errorDetail + '</em>');
                }
            });
        };

        //AJAX request for Venues
        var ajaxFoursquareExplore = function(request) {
            $.ajax({
                url: request,
                success: function(results) {
                    var result = results.response.groups[0].items;
                    //map --> Model/data to viewModel
                    VM.myVenues(ko.utils.arrayMap(result, function(place) {
                        return new VM.Venue(place);
                    }));
                    //run ajax for details, create the markers and setup the categories
                    for (var i = 0, len = VM.myVenues().length; i < len; i++) {
                        var venue = VM.myVenues()[i];
                        ajaxFoursquarePhotos(venue);
                        //Create markers
                        venue.mapMarker = createMarker(venue);
                        var c = venue.category;
                        //Add only once the category
                        if ($.inArray(c, VM.categories()) === -1) {
                            VM.categories.push(c);
                        }
                        VM.categories.sort();
                    }
                },
                error: function(xhr) {
                    successMainData = false;
                    var responseText = $.parseJSON(xhr.responseText);
                    showErrorWindow('Server response: <em>' + responseText.meta.errorDetail + '</em>');
                }
            });
        };

        var createMarker = function(venue) {
            var latLng = new google.maps.LatLng(venue.lat, venue.lng);
            var marker = new google.maps.Marker({
                map: map,
                position: latLng,
                icon: venue.icon.prefix + 'bg_32' + venue.icon.suffix,
            });
            google.maps.event.addListener(marker, 'click', function() {
                showInfoWindow(venue);
            });
            return marker;
        };
        //Make the ajax requests
        ajaxFoursquareExplore(foursquareExplore);
    }

    function ViewModel() {
        var self = this;
        //My Venues built with Foursquare response
        self.myVenues = ko.observableArray();
        self.crtVenue = ko.observable();

        //Categories are built using the results from FourSquare's venues
        self.categories = ko.observableArray();
        //Stores multiple selections
        self.selectedCategories = ko.observableArray();
        self.selectedAllCategories = ko.observable(true);

        //Venue constructor
        self.Venue = function(place) {
            var self = this;
            self.icon = {};
            self.crtPhoto = 0;
            self.photoCount = 0;
            self.photos = [];
            //before ajax 'place' is undefined
            if (place !== undefined) {
                var v = place.venue;
                var c = v.categories[0];
                var l = v.location;
                self.id = v.id;
                self.lat = l.lat;
                self.lng = l.lng;
                self.address = l.formattedAddress;
                self.category = c.shortName;
                self.icon.prefix = c.icon.prefix;
                self.icon.suffix = c.icon.suffix;
                self.description = place.tips[0].text;
                self.name = v.name;
                self.url = v.url;
            } else {
                self.description = '';
                self.photos = [emptyPhoto];
                self.name = '';
                self.url = undefined;
                self.address = [];
                self.address[0] = undefined;
                self.address[1] = undefined;
                self.category = '';
            }
            self.mapMarker = {};
            //Visibility on the map and list is decided using 2 visibility criteria
            self.isCategoryVisible = ko.observable(true);
            self.isQueryVisible = ko.observable(true);
            self.isVisible = ko.computed(function() {
                return self.isCategoryVisible() && self.isQueryVisible();
            });
        };

        //set up the current venue for ko bindings
        self.crtVenue(new self.Venue(undefined));

        //Query string from the search-box
        self.query = ko.observable('');

        /*
        FUNCTIONS
        */
        var showVenue = function(venue) {
            venue.isCategoryVisible(true);
            venue.isQueryVisible(true);
            venue.mapMarker.setVisible(true);
        };

        var hideVenue = function(venue) {
            venue.isCategoryVisible(false);
            venue.mapMarker.setVisible(false);
        };

        //hide or show all venues
        var hideAllVenues = function(hide) {
            $.each(self.myVenues(), function(index, venue) {
                if (hide) {
                    hideVenue(venue);
                } else {
                    showVenue(venue);
                }
            });
        };

        var showInfoForOneVenueFound = function(found, i) {
            if (found === 0) {
                showErrorWindow('No venues found for: <em>"' + self.query() + '"</em>');
            } else {
                errorwindow.close();
                if (found === 1) {
                    showInfoWindow(self.myVenues()[i]);
                }
            }
            if (found > 1) {
                infowindow.close();
            }
        };

        function getPhotoSize(photo) {
            mapWidth = $("#map-canvas").width();
            mapHeight = $('#map-canvas').height();
            var scale = 0.5;
            if (mapWidth >= 1024) {
                scale = 0.25;
            } else if (mapWidth >= 768) {
                scale = 0.3;
            } else if (mapWidth >= 414) {
                scale = 0.4;
            }
            var width = Math.floor(mapWidth * scale);
            var height = Math.floor(width / 1.5);
            var size = width + 'x' + height;
            infowindow.setOptions({
                maxWidth: width
            });
            return size;
        }

        //Content for google.infowindow
        self.showCrtPhoto = function() {
            var v = self.crtVenue();
            var src = '';
            if (v !== undefined) {
                var crtp = v.crtPhoto === v.photoCount ? 0 : v.crtPhoto;
                src = v.photos[crtp].prefix;
                if (v.photos[crtp].suffix !== '') {
                    var sizeStr = getPhotoSize(v.photos[crtp]);
                    src += sizeStr + v.photos[crtp].suffix;
                    crtp++;
                    v.crtPhoto = crtp;
                }
            }
            return src;
        };

        /*
        MODEL METHODS
        */

        //Show or hides all venues based on the checkbox
        self.toggleSelectAll = function() {
            if (self.selectedAllCategories()) {
                hideAllVenues(false);
            } else {
                hideAllVenues(true);
            }
            self.query('');
            return true;
        };

        //Show venues for the selected categories
        self.showVenuesWithSelectedCategories = function() {
            var v = self.myVenues();
            var c = self.selectedCategories();
            self.query('');
            if (self.selectedAllCategories()) {
                self.selectedAllCategories(false);
            }
            var found = 0,
                n = 0;
            for (var i = 0; i < v.length; i++) {
                if ($.inArray(v[i].category, c) > -1) {
                    showVenue(v[i]);
                    found++;
                    n = i;
                } else {
                    hideVenue(v[i]);
                }
            }
            showInfoForOneVenueFound(found, n);
        };

        //Show the google infowindow on list-click
        self.venueListClick = function(venue) {
            showInfoWindow(venue);
        };

        //Show matched venues on "keyup" from the search-box
        self.showSelectedByQuery = function() {
            var q = self.query().toLowerCase();
            var found = 0,
                n = 0;
            var v = self.myVenues();
            for (var i = 0; i < v.length; i++) {
                if (v[i].isCategoryVisible()) {
                    var l = v[i].name.toLowerCase();
                    if (l.indexOf(q) === 0) {
                        v[i].isQueryVisible(true);
                        v[i].mapMarker.setVisible(true);
                        found++;
                        n = i;
                    } else {
                        v[i].isQueryVisible(false);
                        v[i].mapMarker.setVisible(false);
                    }
                }
            }
            showInfoForOneVenueFound(found, n);
        };
        //Show the search-filter pannel and hide the menu button
        self.hideSearchFilterButton = function() {
            $("#search-filter").removeClass('hide');
            $("#btn-search-filter").addClass('hide');
            infowindow.close();
        };
        //Show the list and hide the button
        self.hideListButton = function() {
            $("#list-wrapper").removeClass('hide').css('height', '80px');
            $("#map-wrapper").css('height', 'height: calc(100% - 85px)');
            $("#btn-list").addClass('hide');
        };
    } //end ViewModel

    //binding and getting data
    var VM = new ViewModel();
    //Needed to close the 'errowindow' see the 'errorString' function
    window.VM = VM;
    window.errorwindow = errorwindow;
    ko.applyBindings(VM);
    //fill view model with ajax data
    getData();
});