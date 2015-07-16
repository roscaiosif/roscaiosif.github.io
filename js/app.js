jQuery(function($){
//
//http://www.smartredfox.com/plugins/map-list-pro/
//https://github.com/knockout/knockout/wiki/Asynchronous-Dependent-Observables
//
  function viewModel(){
  	var self = this;
    /*
      Search for food with FourSquare in Montreal and show them on Google Maps
    */
    // Google map parameters
  	var mapCanvas = $('#map-canvas');
    var latM = 45.4960301;
    var lngM = -73.5789544;
  	var montreal = new google.maps.LatLng(latM,lngM);
  	var mapOptions = {
    	zoom: 17,
      center: montreal,
      mapTypeId: google.maps.MapTypeId.ROADMAP,
    };

    //Create the map
    var map = new google.maps.Map(mapCanvas[0], mapOptions);

    //Keep the map centered on resize
    google.maps.event.addDomListener(window, 'resize', function() {
        google.maps.event.trigger(map,'resize');
        map.setCenter(montreal);
      });

    //info windows
    var infowindow = new google.maps.InfoWindow();
    self.errorwindow = new google.maps.InfoWindow();

    //Marker for the "errorwindow"
    var centerMarker = new google.maps.Marker({
                 map: map,
                 position: montreal,
      });
    centerMarker.setVisible(false);

    /*
      MODEL PROPERTIES
    */
    //Categories are built using the results from FourSquare's venues
    self.categories = ko.observableArray([]);
    //Stores multiple selections
    self.selectedCategories = ko.observableArray([]);
    self.selectedAllCategories = ko.observable(true);

    //My Venues built with Foursquare response
    self.myVenues = ko.observableArray([]);

    //Query string from the search-box
    self.query = ko.observable('');

    /*
    FUNCTIONS
    */
    //Venue constructor
    function Venue(place) {
      var self = this;
      var v = place.venue;
      var c = v.categories[0];
      var l = v.location;
      self.id = v.id;
      self.lat = l.lat;
      self.lng = l.lng;
      self.address = l.formattedAddress;
      self.category = c.shortName;
      self.icon ={};
      self.icon.prefix = c.icon.prefix;
      self.icon.suffix = c.icon.suffix;
      self.photoCount = 0;
      self.crtPhoto = 0;
      self.photos =[];
      self.description = place.tips[0].text;
      self.name = v.name;
      self.url = v.url;
      self.mapMarker = {};
      //Vivibility on the map and list is decided using 2 visibility criteria
      self.isCategoryVisible = ko.observable(true);
      self.isQueryVisible = ko.observable(true);
      self.isVisible = ko.computed(function(){
         return self.isCategoryVisible() && self.isQueryVisible();
      });
    }
    //URL for the FourSquare explore venues request
    var searchFor = 'food';
    var searchRadius ='200'; //meters
    var client_id ="JI2X04M51STQLOUGVX0SWEOOSOOSHB2BEMZ0QTPM02TMJGGX";
    var client_secret="4W4IRQJ10E0HKFLK4TFX3KZ4Q25DHQMFKH0IQEYFRG3XDQXQ";
    var foursquareExplore ="https://api.foursquare.com/v2/venues/explore?client_id=";
        foursquareExplore += client_id + "&client_secret=";
        foursquareExplore += client_secret + "&v=20150704&ll=";
        foursquareExplore += latM + ",";
        foursquareExplore += lngM + "&radius=";
        foursquareExplore += searchRadius + "&section=";
        foursquareExplore += searchFor + "&limit=50";

   //ajax for details (photos) for the venues
   var ajaxFoursquarePhotos = function(venue){
      var photos = "https://api.foursquare.com/v2/venues/";
          photos += venue.id + "/photos?client_id=";
          photos += client_id + "&client_secret=";
          photos += client_secret + "&v=20150704";
      $.ajax({
        url:photos,
        success:function(results){
          //number of photos
          var count = results.response.photos.count;
          if (count>0) {
            venue.photoCount = count;
            //use only ten images
            var result = results.response.photos.items;
            for(var i= 0; i<(count<10 ? count : 10);i++) {
              var photo ={};
              photo.prefix = result[i].prefix;
              photo.suffix = result[i].suffix;
              photo.width = result[i].width;
              photo.height = result[i].height;
              venue.photos.push(photo);
            }
          }
        },
        error:function(xhr){
          var responseText=$.parseJSON(xhr.responseText);
          self.showErrorWindow(responseText.meta.errorDetail);
        }
      });
    };

    //AJAX requesting 'food' in Montreal
    var ajaxFoursquareExplore = function(request){
      $.ajax({
        url:request,
        success:function(results){
          var result = results.response.groups[0].items;
          self.myVenues(ko.utils.arrayMap(result, function (place) {
            return new Venue(place);
          }));
          //Categories array and google markers
          for (var i = 0; i < result.length; i++) {
            var mv = self.myVenues()[i];
            //Request photos
            ajaxFoursquarePhotos(mv);
            //Create markers
            mv.mapMarker = createMarker(mv);
            var c = mv.category;
            //Add only once the category
            if ($.inArray(c, self.categories())===-1){
              self.categories.push(c);
            }
          }
          self.categories.sort();
        },
        error:function(xhr){
          var responseText=$.parseJSON(xhr.responseText);
          self.showErrorWindow(responseText.meta.errorDetail);
        }
      });
    };
    //Make the ajax request to fill myVenues array
    ajaxFoursquareExplore(foursquareExplore);

	  var createMarker = function(myVenue) {
      var latLng = new google.maps.LatLng(myVenue.lat, myVenue.lng);
      var marker= new google.maps.Marker({
                 map: map,
                 position: latLng,
                 icon:myVenue.icon.prefix+'bg_32'+myVenue.icon.suffix,
      });
      google.maps.event.addListener(marker, 'click', function() {
				var content = infoString(myVenue);
        infowindow.setContent(content);
        infowindow.open(map, this);
      });
      return marker;
    };

    var showVenue = function(venue){
      venue.isCategoryVisible(true);
      venue.isQueryVisible(true);
      venue.mapMarker.setVisible(true);
    };

    var hideVenue = function(venue){
      venue.isCategoryVisible(false);
      venue.mapMarker.setVisible(false);
    };

    //hide or show all venues
    var hideAllVenues = function(hide){
      $.each(self.myVenues(),function(index,venue){
      	if(hide){
      		hideVenue(venue);
      	} else {
      		showVenue(venue);
      	}
      });
    };

    var showInfoForOneVenueFound = function(found,i){
      if (found === 0){
        self.showErrorWindow('Nothing Found');
      } else{
        self.errorwindow.close();
        if (found === 1){
          showInfoWindow(self.myVenues()[i]);
        }
      }
      if (found > 1){
        infowindow.close();
      }
    };

    //Content for google.infowindow
		var infoString =function(myVenue){
      var pc = myVenue.photoCount;
      //Display up to 10 photos
      var maxPhotos = pc <= 10 ? pc-1:9;
      var content = "<div class='info-window'>";
      //If there are photos display max 10 of them; one after the other in order after each click
      if (pc>0){
        //If reached the last image, reset the the current photo counter
        var crtp = myVenue.crtPhoto === maxPhotos ? 0:myVenue.crtPhoto;
        content += '<img src="'+ myVenue.photos[crtp].prefix;
        content += '300x200' + myVenue.photos[crtp].suffix + '">';
        crtp++;
        myVenue.crtPhoto = crtp;
      }
      //Display venue name
      content += "<h2>"+ myVenue.name + "</h2>";
      //Display tip
      content += '<div class="tip-wrapper"><div class="tip-label">Tip</div><span class="tip">' + myVenue.description + "</span></div>";
      //Display 2 rows of the address if any
      var adr0 = myVenue.address[0];
      var adr1 = myVenue.address[1];
      if (adr0 !== undefined && adr0 !==''){
        content += '<p class="address"><em>' + adr0 + "</em></p>";
      }
      if (adr1 !== undefined && adr1 !==''){
        content += '<p class="address"><em>' + adr1 + "</em></p>";
      }
      //Display venue category
      content += '<p class="category"><em>' + myVenue.category + "</em></p>";
      //Display venue url
      if (myVenue.url !== undefined){
        content += "<a href='"+ myVenue.url + "'>" +myVenue.url +"</a></div>";
      } else {
      	content +="</div>";
      }
      return content;
		};

    //Show the infowindow
    var showInfoWindow = function(venue) {
      var marker = venue.mapMarker;
      var content = infoString(venue);
      infowindow.setContent(content);
      infowindow.open(map, marker);
    };

		var errorString = function(error){
      var content = "<div class='error-window'><h3>"+ error + "</h3>";
      content +='<button onclick="VM.errorwindow.close()">Close</button></div>';
      return content;
		};

    /*
    MODEL METHODS
    */
    //Show or hides all venues based on the checkbox
    self.toggleSelectAll = function(){
      if (self.selectedAllCategories()){
        hideAllVenues(false);
      } else {
        hideAllVenues(true);
      }
      self.query('');
      return true;
    };

    //Show venues for the selected categories
    self.showVenuesWithSelectedCategories = function(){
      var v = self.myVenues();
      var c =self.selectedCategories();
      self.query('');
      if (self.selectedAllCategories()){
        self.selectedAllCategories(false);
      }
      var found =0, n=0;
      for(var i = 0;i<v.length;i++){
        if($.inArray(v[i].category,c)>-1 ){
          showVenue(v[i]);
          found++;
          n=i;
        } else {
          hideVenue(v[i]);
        }
      }
      showInfoForOneVenueFound(found,n);
    };

   self.showErrorWindow = function(error) {
      var content = errorString(error);
      self.errorwindow.setContent(content);
      self.errorwindow.open(map,centerMarker);
      infowindow.close();
    };

    //Show the google infowindow on list-click
    self.venueListClick = function(venue){
      showInfoWindow(venue);
    };

    //Show matched venues on "keyup" from the search-box
    self.showSelectedByQuery = function(){
      var q = self.query().toLowerCase();
      var found=0, n = 0;
      var v = self.myVenues();
      for (var i=0;i<v.length;i++){
        if (v[i].isCategoryVisible()){
          var l = v[i].name.toLowerCase();
          if (l.indexOf(q)===0){
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
      showInfoForOneVenueFound(found,n);
    };
  } //end viewModel

  var VM = new viewModel();
  //Needed to close the 'errowindow' see the 'errorString' function
  window.VM=VM;
  ko.applyBindings(VM);
});