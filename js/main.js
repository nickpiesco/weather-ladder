var API_KEY = [API key goes here];

/**
 * Poor man’s jQuery
 */
var $ = document.querySelector.bind(document);

/**
 * Make Color globally available
 */
var Color = net.brehaut.Color;

/**
 * Utility functions
 */

/**
 * Fairly standard XHR gubbins
 * @param {string} url - Endpoint URL
 * @param {function} successCallback - Function to execute on success
 * @returns {object}
 */
function ajax (url, successCallback) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', url, true);
  xhr.setRequestHeader("Content-type", "application/json");

  xhr.onload = function () {
    if (xhr.status >= 200 && xhr.status < 400) {
      var data = JSON.parse(xhr.responseText);
      successCallback(data);
    } else {
      showErrorMessage();
    }
  };

  xhr.onerror = function () {
    showErrorMessage();
  };

  xhr.send();
}

/**
 * Hide splash screen or modal
 */
function hideFullscreen (className) {
  var element = $('.' + className);

  element.classList.remove('fullscreen-open');
}

/**
 * Show splash screen or modal
 */
 function showFullscreen (className) {
  var element = $('.' + className);

  element.classList.add('fullscreen-open');
}

/**
 * Application guts
 */

/**
 * Calculate background colour based on temperature
 * @param {number} temp - Temperature to calculate value from
 * @returns {string}
 */
function getColor (temp) {
  
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
  var splitTemp = ((temp / 10).toString()).split('.') || 0;

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
 * Gets system time and writes it to the DOM
 */
function getTime () {
  var currentTime = moment().format('h:mm a');
  $('.js-time').innerHTML = currentTime;
}

/**
 * Write human-readable location to the DOM
 * @param {number} lat - Latitude
 * @param {number} long - Longitude
 */
function renderLocation (lat, long) {
  var url = '//nominatim.openstreetmap.org/reverse?format=json&lat=' +
    lat + '&lon=' + long;

  ajax(url, function (response) {

    // Fallbacks here are complex. Punt!
    $('.js-location').innerHTML = response.address.city || '';
  });
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

  // Colour the current conditions background and change
  // the text and icon colour based on its luminance
  var currentTempColor = getColor(weather.currentTemp);
  var backgroundLuminance = Color(currentTempColor).getLuminance();

  $('.js-current').style.backgroundColor = currentTempColor;

  // Color’s function is slightly different, but I pulled
  // the ‘0.65’ magic number from here:
  // https://gist.github.com/jlong/f06f5843104ee10006fe
  if (backgroundLuminance > 0.65) {
    $('.js-current').classList.add('dark');
  }

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
 * Request weather for the given location
 * @param {number} lat - Latitude
 * @param {number} long - Longitude
 */
function requestWeather (lat, long) {

  // Using a CORS proxy because I didn’t want to use jQuery for JSONP
  // or faff about with a server-side proxy of my own
  var proxy = '//crossorigin.me/';

  var url = proxy + 'https://api.darksky.net/forecast/' + API_KEY + '/' +
    lat + ',' + long;

  // Make the request
  ajax(url, function (data) {
    renderWeather(data);
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
 * Initialize the application
 */
function initialize () {
  showFullscreen('js-splash'); // Make sure splash screen shows while we load
  getTime();
  getLocation();
}

/**
 * Event listeners
 */

$('.js-open-modal').addEventListener('click', function () {
  showFullscreen('js-modal');
});

$('.js-close-modal').addEventListener('click', function () {
  hideFullscreen('js-modal');
});

$('.js-reset-location').addEventListener('click', function () {
  resetLocation();
});

/**
 * Time to make the chimichangas
 */
initialize();
