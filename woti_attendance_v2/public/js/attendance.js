// public/js/attendance.js
/**
 * Attendance Page JavaScript
 * Handles GPS capture and attendance clock in/out operations
 * Enhanced with accuracy validation and device fingerprinting
 */

(function() {
  'use strict';

  // GPS Configuration
  const GPS_CONFIG = {
    MIN_ACCURACY_FOR_CLOCK: 100,      // Maximum acceptable accuracy (meters)
    TARGET_ACCURACY: 50,               // Target accuracy for enabling clock-in
    MAX_WAIT_TIME: 60000,              // Maximum wait time for GPS (ms)
    HIGH_ACCURACY_OPTIONS: {
      enableHighAccuracy: true,
      timeout: 30000,
      maximumAge: 0
    }
  };

  // DOM Elements
  const alertDiv = document.getElementById('alert');
  const userNameEl = document.getElementById('userName');
  const userFacilityEl = document.getElementById('userFacility');
  const statusBadgeEl = document.getElementById('statusBadge');
  const clockInTimeSectionEl = document.getElementById('clockInTimeSection');
  const clockInTimeDisplayEl = document.getElementById('clockInTimeDisplay');
  const gpsStatusEl = document.getElementById('gpsStatus');
  const gpsStatusTextEl = document.getElementById('gpsStatusText');
  const gpsCoordinatesEl = document.getElementById('gpsCoordinates');
  const gpsAccuracyEl = document.getElementById('gpsAccuracy');
  const clockInBtn = document.getElementById('clockInBtn');
  const clockOutBtn = document.getElementById('clockOutBtn');
  const loadingEl = document.getElementById('loading');

  // State
  let currentUser = null;
  let currentLocation = null;
  let isClockedIn = false;
  let activeAttendance = null;
  let gpsWatchId = null;
  let gpsReady = false;
  let deviceFingerprint = null;

  // Check authentication
  function getToken() {
    return localStorage.getItem('token');
  }

  function checkAuth() {
    const token = getToken();
    if (!token) {
      window.location.href = '/index.html';
      return false;
    }
    return true;
  }

  // Show alert message
  function showAlert(message, type = 'error') {
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    alertDiv.style.display = 'block';
        
    if (type !== 'error') {
      setTimeout(() => {
        alertDiv.style.display = 'none';
      }, 5000);
    }
  }

  // Hide alert
  function hideAlert() {
    alertDiv.style.display = 'none';
  }

  // Show/hide loading
  function setLoading(show) {
    loadingEl.classList.toggle('show', show);
    updateButtonStates();
  }

  // Update button states based on GPS readiness
  function updateButtonStates() {
    const isLoading = loadingEl.classList.contains('show');
    clockInBtn.disabled = isLoading || !gpsReady;
    clockOutBtn.disabled = isLoading || !gpsReady;
  }

  // Format time
  function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  }

  // Update UI based on status
  function updateStatusUI() {
    if (isClockedIn) {
      statusBadgeEl.className = 'status-badge status-clocked-in';
      statusBadgeEl.textContent = '✓ Clocked In';
      clockInBtn.classList.add('hidden');
      clockOutBtn.classList.remove('hidden');
            
      if (activeAttendance && activeAttendance.clock_in_time) {
        clockInTimeSectionEl.classList.remove('hidden');
        clockInTimeDisplayEl.textContent = formatTime(activeAttendance.clock_in_time);
      }
    } else {
      statusBadgeEl.className = 'status-badge status-clocked-out';
      statusBadgeEl.textContent = '○ Not Clocked In';
      clockInBtn.classList.remove('hidden');
      clockOutBtn.classList.add('hidden');
      clockInTimeSectionEl.classList.add('hidden');
    }

    updateButtonStates();
  }

  // Fetch user info and status
  async function fetchUserAndStatus() {
    try {
      const token = getToken();
            
      // Fetch user info
      const userResponse = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!userResponse.ok) {
        if (userResponse.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/index.html';
          return;
        }
        throw new Error('Failed to fetch user info');
      }

      const userData = await userResponse.json();
      currentUser = userData.data.user;

      userNameEl.textContent = `${currentUser.first_name} ${currentUser.last_name}`;
      userFacilityEl.textContent = currentUser.facility_name || 'No facility assigned';

      // Fetch attendance status
      const statusResponse = await fetch('/api/attendance/status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        isClockedIn = statusData.data.isClockedIn;
        activeAttendance = statusData.data.activeAttendance;
      }

      updateStatusUI();
    } catch (error) {
      console.error('Error fetching user/status:', error);
      showAlert('Failed to load user information');
    }
  }

  // Generate device fingerprint
  function generateDeviceFingerprint() {
    const components = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || 'unknown',
      navigator.platform
    ];
        
    // Create a simple hash of the components
    const str = components.join('|');
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
        
    // Add random component from crypto for uniqueness
    const randomPart = getDeviceId().split('-')[1] || 'default';
        
    return 'fp-' + Math.abs(hash).toString(16) + '-' + randomPart;
  }

  // GPS Functions with enhanced accuracy
  function initGPS() {
    if (!navigator.geolocation) {
      gpsStatusEl.classList.remove('acquiring');
      gpsStatusTextEl.textContent = 'GPS not supported';
      showAlert('Geolocation is not supported by your browser', 'error');
      return;
    }

    gpsStatusTextEl.textContent = 'Acquiring GPS (high accuracy)...';
    gpsStatusEl.classList.add('acquiring');

    // Start watching position with high accuracy
    gpsWatchId = navigator.geolocation.watchPosition(
      handleGPSSuccess,
      handleGPSError,
      GPS_CONFIG.HIGH_ACCURACY_OPTIONS
    );

    // Set timeout for GPS acquisition
    setTimeout(() => {
      if (!gpsReady && currentLocation) {
        // Accept current location if we have one, even if accuracy is not ideal
        if (currentLocation.accuracy <= GPS_CONFIG.MIN_ACCURACY_FOR_CLOCK) {
          gpsReady = true;
          updateButtonStates();
          showAlert('GPS ready. You can now clock in/out.', 'info');
        } else {
          showAlert(`GPS accuracy is ${Math.round(currentLocation.accuracy)}m. Please move to an open area for better signal.`, 'warning');
        }
      }
    }, GPS_CONFIG.MAX_WAIT_TIME);
  }

  function handleGPSSuccess(position) {
    const accuracy = position.coords.accuracy;
        
    currentLocation = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: accuracy,
      timestamp: position.timestamp
    };

    // Update display
    gpsCoordinatesEl.textContent = `${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}`;
        
    // Color-code accuracy display
    const accuracyText = `±${Math.round(accuracy)} meters`;
    if (accuracy <= GPS_CONFIG.TARGET_ACCURACY) {
      gpsAccuracyEl.innerHTML = `<span style="color: #28a745;">${accuracyText} ✓</span>`;
    } else if (accuracy <= GPS_CONFIG.MIN_ACCURACY_FOR_CLOCK) {
      gpsAccuracyEl.innerHTML = `<span style="color: #ffc107;">${accuracyText}</span>`;
    } else {
      gpsAccuracyEl.innerHTML = `<span style="color: #dc3545;">${accuracyText} (too low)</span>`;
    }

    // Check if accuracy is acceptable
    if (accuracy <= GPS_CONFIG.MIN_ACCURACY_FOR_CLOCK) {
      gpsStatusEl.classList.remove('acquiring');
            
      if (accuracy <= GPS_CONFIG.TARGET_ACCURACY) {
        gpsStatusTextEl.textContent = 'GPS location acquired (excellent)';
      } else {
        gpsStatusTextEl.textContent = 'GPS location acquired (acceptable)';
      }

      // Enable clock-in/out buttons
      if (!gpsReady) {
        gpsReady = true;
        updateButtonStates();
        hideAlert();
      }
    } else {
      gpsStatusTextEl.textContent = `Improving accuracy (${Math.round(accuracy)}m)...`;
      gpsReady = false;
      updateButtonStates();
    }
  }

  function handleGPSError(error) {
    gpsStatusEl.classList.remove('acquiring');
    gpsReady = false;
    updateButtonStates();
        
    let message = 'Unable to get GPS location';
    switch (error.code) {
    case error.PERMISSION_DENIED:
      message = 'GPS permission denied. Please enable location access.';
      gpsStatusTextEl.textContent = 'Permission denied';
      break;
    case error.POSITION_UNAVAILABLE:
      message = 'GPS position unavailable. Please try again.';
      gpsStatusTextEl.textContent = 'Position unavailable';
      break;
    case error.TIMEOUT:
      message = 'GPS request timed out. Please try again.';
      gpsStatusTextEl.textContent = 'GPS timeout';
      break;
    }

    showAlert(message, 'warning');
    gpsCoordinatesEl.textContent = 'Not available';
    gpsAccuracyEl.textContent = '--';
  }

  // Check if location is mocked (Android only, limited detection)
  function checkMockLocation() {
    // This is a basic check - full mock detection requires native app support
    // The server will do additional validation
    return false;
  }

  // Clock In
  async function clockIn() {
    if (!currentLocation) {
      showAlert('Please wait for GPS location to be acquired');
      return;
    }

    if (currentLocation.accuracy > GPS_CONFIG.MIN_ACCURACY_FOR_CLOCK) {
      showAlert(`GPS accuracy too low (${Math.round(currentLocation.accuracy)}m). Maximum allowed: ${GPS_CONFIG.MIN_ACCURACY_FOR_CLOCK}m. Please move to an open area.`);
      return;
    }

    setLoading(true);
    hideAlert();

    try {
      const token = getToken();
      const deviceId = getDeviceId();

      const response = await fetch('/api/attendance/clock-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          facility_id: currentUser.facility_id,
          clock_in_latitude: currentLocation.latitude,
          clock_in_longitude: currentLocation.longitude,
          accuracy: currentLocation.accuracy,
          is_mocked: checkMockLocation(),
          device_id: deviceId,
          device_fingerprint: deviceFingerprint
        })
      });

      const data = await response.json();

      if (response.ok) {
        isClockedIn = true;
        activeAttendance = data.data.attendance;
        updateStatusUI();
        showAlert('Successfully clocked in!', 'success');
      } else {
        showAlert(data.message || 'Failed to clock in');
      }
    } catch (error) {
      console.error('Clock in error:', error);
      showAlert('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }

  // Clock Out
  async function clockOut() {
    if (!currentLocation) {
      showAlert('Please wait for GPS location to be acquired');
      return;
    }

    if (currentLocation.accuracy > GPS_CONFIG.MIN_ACCURACY_FOR_CLOCK) {
      showAlert(`GPS accuracy too low (${Math.round(currentLocation.accuracy)}m). Maximum allowed: ${GPS_CONFIG.MIN_ACCURACY_FOR_CLOCK}m. Please move to an open area.`);
      return;
    }

    setLoading(true);
    hideAlert();

    try {
      const token = getToken();

      const response = await fetch('/api/attendance/clock-out', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          clock_out_latitude: currentLocation.latitude,
          clock_out_longitude: currentLocation.longitude,
          accuracy: currentLocation.accuracy,
          is_mocked: checkMockLocation(),
          device_fingerprint: deviceFingerprint
        })
      });

      const data = await response.json();

      if (response.ok) {
        isClockedIn = false;
        activeAttendance = null;
        updateStatusUI();
        showAlert('Successfully clocked out!', 'success');
      } else {
        showAlert(data.message || 'Failed to clock out');
      }
    } catch (error) {
      console.error('Clock out error:', error);
      showAlert('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }

  // Get or generate device ID using secure random values
  function getDeviceId() {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      // Use crypto.getRandomValues for better entropy
      const array = new Uint8Array(16);
      if (window.crypto && window.crypto.getRandomValues) {
        window.crypto.getRandomValues(array);
        const randomHex = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
        deviceId = 'web-' + randomHex.substring(0, 16) + '-' + Date.now();
      } else {
        // Fallback for older browsers
        deviceId = 'web-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
      }
      localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
  }

  // Event Listeners
  clockInBtn.addEventListener('click', clockIn);
  clockOutBtn.addEventListener('click', clockOut);

  // Initialize
  function init() {
    if (!checkAuth()) return;
        
    // Generate device fingerprint
    deviceFingerprint = generateDeviceFingerprint();
        
    fetchUserAndStatus();
    initGPS();
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (gpsWatchId) {
      navigator.geolocation.clearWatch(gpsWatchId);
    }
  });

  // Start
  init();
})();
