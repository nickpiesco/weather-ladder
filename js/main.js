var API_KEY = [API key goes here];

// Poor man’s jQuery
var $ = document.querySelector.bind(document);

/**
 * Fairly standard XHR gubbins
 * @param {string} url - Endpoint URL
 * @param {function} successCallback - Function to execute on success
 * @returns {object}
 */
function ajax (url, successCallback) {
  var req = new XMLHttpRequest();
  req.open('GET', url, true);
  req.setRequestHeader("Content-type", "application/json");

  req.onload = function () {
    if (req.status >= 200 && req.status < 400) {
      var data = JSON.parse(req.responseText);
      successCallback(data);
    } else {
      showErrorMessage();
    }
  };

  req.onerror = function () {
    showErrorMessage();
  };

  req.send();
}

/**
 * Show splash screen or modal
 */
 function showFullscreen (className) {
  var element = $('.' + className);

  element.classList.add('fullscreen-open');
}

/**
 * Hide splash screen or modal
 */
function hideFullscreen (className) {
  var element = $('.' + className);

  element.classList.remove('fullscreen-open');
}

/**
 * Calculate background colour based on temperature
 * @param {number} temp - Temperature to calculate value from
 * @returns {string}
 */
function getColor (temp) {
  var Color = net.brehaut.Color;
  
  // Temperature gradient stops. We’re going to find the bin
  // the temperature goes into, then use ‘blend()’ to interpolate
  // the correct position between the stops.
  var tempBins = {
    '-40': '#ffdadc',
    '-30': '#b9fdfd',
    '-20': '#bcd3fd',
    '-10': '#fc50f4',
    '0': '#e80086',
    '10': '#2e0086',
    '20': '#11000c',
    '30': '#18c8dc',
    '40': '#0def00',
    '50': '#004d00',
    '60': '#e8f800',
    '70': '#ff5200',
    '80': '#ff0f00',
    '90': '#8f0000',
    '100': '#360040',
    '110': '#a90053'
  };
  
  // Dump out if temp is out of range
  if (temp < -40) {
    return tempBins['-40'];
  }
  if (temp >= 120) {
    return tempBins['110'];
  }
  
  // Fun with numbers

  // We need to find the tens digit[s] of the temperature
  // to put it in the appropriate bin and save the ones digit
  // to send to ‘blend()’ below as the ‘alpha’ property
  var splitTemp = ((temp / 10).toString()).split('.')  || 0;

  // Break off the tens digit[s] to get the bounds of the bin
  var lowerBound = splitTemp[0] * 10;
  var upperBound = lowerBound + 10;

  // Now that we know which bin the temp goes in, we need to find where
  // in the bin it is. ‘blend()’ lets us weight the colours accordingly –
  // we have a digit, but we need a value between 0 and 1.
  var alpha = splitTemp[1] / 10 || 0;

  // Grab the corresponding values from the object
  var color1 = Color(tempBins[lowerBound.toString()]);
  var color2 = Color(tempBins[upperBound.toString()]);

  // Return blended colour
  return color1.blend(color2, alpha).toCSS();
}

/**
 * Gets system time and writes it to the DOM
 */
function getTime () {
  var currentTime = moment().format('h:mm a');
  $('.js-time').innerHTML = currentTime;
}

/**
 * Get current location and send it to the API request
 */
function getLocation () {

  // Bypass geolocation if we’ve already been here –
  // naïve cookie implementation incoming!
  var cookie = document.cookie;

  // Make sure we’re getting the correct cookie (‘position’)
  if (cookie.split('=')[0] === 'position') {
    var positionFromCookie = cookie.split('=')[1].split(',');

    lat = positionFromCookie[0];
    long = positionFromCookie[1];

    // See below as to why these are inside the conditional and not outside
    requestWeather(lat, long);
    renderLocation(lat, long);
  } else {

    // Use browser geolocation
    navigator.geolocation.getCurrentPosition(function (position) {

      lat = position.coords.latitude;
      long = position.coords.longitude;

      // Set a cookie so we don’t have to do this again
      document.cookie = 'position=' + lat + ',' + long;

      // These need to be here and not outside the conditional
      // to keep the API calls from choking on undefined ‘lat’ and ‘long’
      // until the browser finds a position (a few seconds)
      requestWeather(lat, long);
      renderLocation(lat, long);
    });
  }
}

/**
 * Write human-readable location to the DOM
 * @param {number} lat - Latitude
 * @param {number} long - Longitude
 */
function renderLocation (lat, long) {
  var url = 'http://nominatim.openstreetmap.org/reverse?format=json&lat=' +
    lat + '&lon=' + long;

  ajax(url, function (response) {

    // Using ‘city’ is a little brittle, but it’ll work for now
    $('.js-location').innerHTML = response.address.city;
  });
}

/**
 * Clear cookie and initialise again to re-fetch location
 */
function resetLocation () {

  // Remove existing cookie
  document.cookie = 'position=""; expires=Thu, 01 Jan 1970 00:00:01 GMT;';

  // Close modal
  hideFullscreen('js-modal');

  // Fire geolocation again
  initialize();
}

/**
 * Request weather for the given location
 * @param {number} lat - Latitude
 * @param {number} long - Longitude
 */
function requestWeather (lat, long) {

  // Using a CORS proxy because I didn’t want to use jQuery for JSONP
  // or faff about with a server-side proxy of my own
  var proxy = 'http://crossorigin.me/';

  var url = proxy + 'https://api.forecast.io/forecast/' + API_KEY + '/' +
    lat + ',' + long;

  // Make the request
  ajax(url, function (data) {
    renderWeather(data);
  });
}

/**
 * Show error message
 */
function showErrorMessage () {
  showFullscreen('js-error');
}

/**
 * Munge data from the API response into something we can use
 * @param {object} data - API response
 * @returns {object}
 */
function weatherModel (data) {

  // Our model
  var weather = {
    currentIcon: '',
    currentWeather: '',
    currentTemp: null,
    forecast: [
      {forecastTemp: null},
      {forecastTemp: null},
      {forecastTemp: null},
      {forecastTemp: null},
      {forecastTemp: null},
      {forecastTemp: null},
      {forecastTemp: null},
      {forecastTemp: null},
      {forecastTemp: null},
      {forecastTemp: null},
      {forecastTemp: null},
      {forecastTemp: null},
      {forecastTemp: null}
    ]
  };
  
  // Tuck API response bits into the correct places
  weather.currentIcon = data.currently.icon || 'default';
  weather.currentWeather = data.currently.summary;

  // ‘getColor()’ expects an integer, so we’ll just do this now
  weather.currentTemp = Math.round(data.currently.temperature);

  // Loop over forecast data to populate our ‘forecast’ array
  // (the API returns more than 12 hours’ worth of data, but
  // we just ignore what we don’t need)
  for (i = 0; i < weather.forecast.length; i++) {
    weather.forecast[i].forecastTemp =
      Math.round(data.hourly.data[i].temperature);
  }

  return weather;
}

/**
 * Choose the correct icon and colours
 * @param {object} data - Our current weather object
 */
function renderWeather (data) {

  // Get our model
  var weather = weatherModel(data);

  // Populate temperature and current conditions
  $('.js-temp').innerHTML = weather.currentTemp;
  $('.js-weather').innerHTML = weather.currentWeather;

  // Get filename of the correct icon (or not)
  var defaultIconPath = 'images/icons/default.svg';
  var currentIconPath = 'images/icons/' + weather.currentIcon + '.svg';

  // Replace default icon with the correct one
  $('.js-icon').src = $('.js-icon').src
    .replace(defaultIconPath, currentIconPath);

  // Colour the current conditions background
  $('.js-current').style.backgroundColor = getColor(weather.currentTemp);

  // Colour the forecast backgrounds
  // (starting the loop with 1 and not 0 because data[0] is current)
  for (i = 1; i < weather.forecast.length; i++) {
    $('.js-forecast-' + i).style.backgroundColor =
      getColor(weather.forecast[i].forecastTemp);
  }

  // Remove the splash, since hopefully we’re all done processing by now
  hideFullscreen('js-splash');
}

/**
 * Initialise the application
 */
function initialize () {
  showFullscreen('js-splash'); // Make sure splash screen shows while we load
  getTime();
  getLocation();
}

// Event listeners

$('.js-open-modal').addEventListener('click', function () {
  showFullscreen('js-modal');
});

$('.js-close-modal').addEventListener('click', function () {
  hideFullscreen('js-modal');
});

$('.js-reset-location').addEventListener('click', function () {
  resetLocation();
});

// Time to make the chimichangas
initialize();
