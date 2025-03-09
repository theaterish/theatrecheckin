// Location tracking state
let userLocation = null;
let locationPermissionGranted = false;
let locationWatchId = null;

// DOM elements
const locationStatus = document.getElementById('location-status');
const checkInButton = document.getElementById('checkInButton');

/**
 * Initialize location services
 */
function initLocationServices() {
  // Check if Geolocation is supported
  if ('geolocation' in navigator) {
    requestLocationPermission();
  } else {
    updateLocationStatus('Geolocation is not supported by your browser', 'error');
    disableCheckIn('Your device does not support location services required for check-in');
  }
}

/**
 * Request permission to access user's location
 */
function requestLocationPermission() {
  updateLocationStatus('Requesting location permission...', 'pending');
  
  navigator.permissions.query({ name: 'geolocation' }).then(permissionStatus => {
    console.log('Geolocation permission status:', permissionStatus.state);
    
    if (permissionStatus.state === 'granted') {
      locationPermissionGranted = true;
      startLocationTracking();
    } else if (permissionStatus.state === 'prompt') {
      // We need to ask for permission
      updateLocationStatus('Please allow location access when prompted', 'pending');
      // Trigger the permission prompt by getting the position once
      navigator.geolocation.getCurrentPosition(
        () => {
          locationPermissionGranted = true;
          startLocationTracking();
        },
        (error) => handleLocationError(error),
        { enableHighAccuracy: true }
      );
    } else if (permissionStatus.state === 'denied') {
      locationPermissionGranted = false;
      updateLocationStatus('Location access denied. Please enable location services to check in', 'error');
      disableCheckIn('Location permission is required to check in');
    }
    
    // Listen for permission changes
    permissionStatus.onchange = function() {
      if (this.state === 'granted') {
        locationPermissionGranted = true;
        startLocationTracking();
      } else {
        locationPermissionGranted = false;
        stopLocationTracking();
        updateLocationStatus('Location access denied. Please enable location services to check in', 'error');
        disableCheckIn('Location permission is required to check in');
      }
    };
  });
}

/**
 * Start tracking user location
 */
function startLocationTracking() {
  updateLocationStatus('Getting your location...', 'pending');
  
  // Clear any existing watch
  stopLocationTracking();
  
  // Start a new watch
  locationWatchId = navigator.geolocation.watchPosition(
    (position) => {
      userLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp
      };
      
      checkLocationForRehearsalVenue();
    },
    (error) => handleLocationError(error),
    { 
      enableHighAccuracy: true, 
      maximumAge: 30000,     // 30 seconds
      timeout: 27000         // 27 seconds
    }
  );
}

/**
 * Stop tracking user location
 */
function stopLocationTracking() {
  if (locationWatchId !== null) {
    navigator.geolocation.clearWatch(locationWatchId);
    locationWatchId = null;
  }
}

/**
 * Handle location errors
 */
function handleLocationError(error) {
  console.error('Location error:', error);
  
  switch (error.code) {
    case error.PERMISSION_DENIED:
      updateLocationStatus('Location access denied. Please enable location services to check in', 'error');
      disableCheckIn('Location permission is required to check in');
      break;
    case error.POSITION_UNAVAILABLE:
      updateLocationStatus('Location information is unavailable. Please try again later', 'error');
      disableCheckIn('Unable to determine your location');
      break;
    case error.TIMEOUT:
      updateLocationStatus('Location request timed out. Please try again', 'error');
      setTimeout(startLocationTracking, 5000); // Try again after 5 seconds
      break;
    default:
      updateLocationStatus('An unknown error occurred getting your location', 'error');
      disableCheckIn('Error determining your location');
      break;
  }
}

/**
 * Check if user is at the rehearsal venue
 */
function checkLocationForRehearsalVenue() {
  if (!userLocation) {
    updateLocationStatus('Waiting for your location...', 'pending');
    return false;
  }
  
  // Calculate distance from rehearsal venue
  const distance = calculateDistance(
    userLocation.latitude,
    userLocation.longitude,
    REHEARSAL_LOCATION.latitude,
    REHEARSAL_LOCATION.longitude
  );
  
  console.log(`Distance to venue: ${distance.toFixed(2)} meters (accuracy: ${userLocation.accuracy} meters)`);
  
  if (distance <= REHEARSAL_LOCATION.radius) {
    // User is at the venue
    updateLocationStatus('✓ Location verified: You are at the theatre', 'success');
    enableCheckIn();
    return true;
  } else {
    // User is not at the venue
    updateLocationStatus(`You are ${distance.toFixed(0)} meters away from ${REHEARSAL_LOCATION.name}`, 'pending');
    disableCheckIn('You must be at the rehearsal location to check in');
    return false;
  }
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  
  return d; // Distance in meters
}

/**
 * Update the location status message
 */
function updateLocationStatus(message, type = 'pending') {
  if (!locationStatus) return;
  
  locationStatus.textContent = message;
  locationStatus.className = `location-status ${type}`;
}

/**
 * Enable the check-in button
 */
function enableCheckIn() {
  if (!checkInButton) return;
  
  checkInButton.disabled = false;
  checkInButton.title = "Click to check in to rehearsal";
}

/**
 * Disable the check-in button
 */
function disableCheckIn(reason) {
  if (!checkInButton) return;
  
  checkInButton.disabled = true;
  checkInButton.title = reason || "Check-in currently unavailable";
}
