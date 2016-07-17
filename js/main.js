// Poor man’s jQuery
var $ = document.querySelector.bind(document);

function ajax (url, successCallback) {
  var req = new XMLHttpRequest();
  req.open('GET', url, true);
  req.setRequestHeader("Content-type", "application/json");

  req.onload = function() {
    if (req.status >= 200 && req.status < 400) {
      var data = JSON.parse(req.responseText);
      successCallback(data);
    } else {
      console.error('Sorry, the request returned an error.')
    }
  };

  req.onerror = function() {
    console.error('Sorry, there was a connection error.')
  };

  req.send();
}

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

  // Time to make the chimichangas

  // Grab the corresponding values from the object
  var color1 = Color(tempBins[lowerBound.toString()]);
  var color2 = Color(tempBins[upperBound.toString()]);

  // Return blended colour
  return color1.blend(color2, alpha).toCSS();
}

function getTime () {
  var currentTime = moment().format('h:mm a');
  $('.js-time').innerHTML = currentTime;
}


function getWeather (source) {
  ajax(source, function (data) {
    renderWeather(data);
  });
}

function weatherModel (data) {
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
  
  weather.currentIcon = data.currently.icon || 'default';
  weather.currentWeather = data.currently.summary;
  weather.currentTemp = Math.round(data.currently.temperature);

  for (i = 0; i < weather.forecast.length; i++) {
    weather.forecast[i].forecastTemp = Math.round(data.hourly.data[i].temperature);
  }

  return weather;
}

function renderWeather (data) {
  var weather = weatherModel(data);

  $('.js-temp').innerHTML = weather.currentTemp;
  $('.js-weather').innerHTML = weather.currentWeather;

  var defaultIconPath = 'images/icons/default.svg';
  var currentIconPath = 'images/icons/' + weather.currentIcon + '.svg';
  $('.js-icon').src = $('.js-icon').src.replace(defaultIconPath, currentIconPath);

  $('.js-current').style.backgroundColor = getColor(weather.currentTemp);

  // Starting with 1 and not 0 because data[0] is current
  for (i = 1; i < weather.forecast.length; i++) {
    $('.js-forecast-' + i).style.backgroundColor = getColor(weather.forecast[i].forecastTemp);
  }
}

getTime();
getWeather('js/katt.json');
