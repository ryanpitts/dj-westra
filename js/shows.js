document.addEventListener('DOMContentLoaded', function () {
  fetch('data/shows.json')
    .then(function (response) { return response.json(); })
    .then(function (shows) {
      shows.forEach(function (show) { show.dateObj = parseDate(show.show_date); });

      var today = new Date();
      today.setHours(0, 0, 0, 0);

      var upcoming = shows.filter(function (show) { return show.dateObj >= today; })
        .sort(function (a, b) { return a.dateObj - b.dateObj; });
      var recent = shows.filter(function (show) { return show.dateObj < today; })
        .sort(function (a, b) { return b.dateObj - a.dateObj; });

      renderShows('upcoming-shows', upcoming, true, false, false, '  ·  ');
      renderShows('recent-shows', recent, false, true, true, ', ');
    });
});

function parseDate(dateValue) {
  var isoParts = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoParts) {
    return new Date(Number(isoParts[1]), Number(isoParts[2]) - 1, Number(isoParts[3]));
  }
  return new Date(dateValue);
}

function formatDate(dateObj, includeWeekday) {
  var months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var date = months[dateObj.getMonth()] + ' ' + dateObj.getDate();
  return includeWeekday ? days[dateObj.getDay()] + ', ' + date : date;
}

function formatTime(time) {
  if (!time) return '';
  var segments = time.split('-').map(parseSingleTime);
  if (segments.indexOf(null) !== -1) return '';

  if (segments.length === 2 && segments[0].meridiem === segments[1].meridiem) {
    return formatTimeParts(segments[0], false) + '-' + formatTimeParts(segments[1], true);
  }

  return segments.map(function (segment) { return formatTimeParts(segment, true); }).join('-');
}

function parseSingleTime(time) {
  var match = time.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!match) return null;
  return { hour: match[1], minutes: match[2], meridiem: match[3].toLowerCase() };
}

function formatTimeParts(time, includeMeridiem) {
  var base = !time.minutes || time.minutes === '00' ? time.hour : time.hour + ':' + time.minutes;
  return includeMeridiem ? base + time.meridiem : base;
}

function squareArtworkUrl(url) {
  var parts = url.split('/');
  parts[parts.length - 1] = '600x600bb.jpg';
  return parts.join('/');
}

function renderShows(listId, shows, includeWeekday, includeImage, hideTimeWithoutPlaylist, timeSeparator) {
  var list = document.getElementById(listId);
  shows.forEach(function (show) {
    var li = document.createElement('li');

    if (includeImage) {
      var img = document.createElement('img');
      img.src = show.show_image ? squareArtworkUrl(show.show_image) : 'img/show-placeholder.svg';
      img.alt = '';
      img.className = 'show-thumb';

      if (show.playlist_url) {
        var thumbLink = document.createElement('a');
        thumbLink.href = show.playlist_url;
        thumbLink.appendChild(img);
        li.appendChild(thumbLink);
      } else {
        li.appendChild(img);
      }
    }

    var details = document.createElement('span');
    details.className = 'show-details';

    var meta = document.createElement('span');
    meta.className = 'show-meta';
    var time = (hideTimeWithoutPlaylist && !show.playlist_url) ? '' : formatTime(show.show_time);
    var dateText = formatDate(show.dateObj, includeWeekday) + (time ? timeSeparator + time : '');
    meta.appendChild(document.createTextNode(dateText + ' at '));

    if (show.venue_url) {
      var venueLink = document.createElement('a');
      venueLink.href = show.venue_url;
      venueLink.textContent = show.venue;
      meta.appendChild(venueLink);
    } else {
      meta.appendChild(document.createTextNode(show.venue));
    }
    details.appendChild(meta);

    if (show.playlist_url) {
      var listen = document.createElement('span');
      listen.className = 'show-listen';
      listen.appendChild(document.createTextNode(' ~ '));
      var playlistLabelFull = document.createElement('span');
      playlistLabelFull.className = 'playlist-label-full';
      playlistLabelFull.textContent = 'listen to the ';
      listen.appendChild(playlistLabelFull);
      listen.appendChild(document.createTextNode('playlist '));
      var link = document.createElement('a');
      link.href = show.playlist_url;
      link.className = 'apple-icon';
      listen.appendChild(link);
      details.appendChild(listen);
    }

    li.appendChild(details);
    list.appendChild(li);
  });
}
