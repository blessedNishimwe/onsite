// public/js/attendance.js
/**
 * Attendance Page JavaScript
 * Handles GPS capture and attendance clock in/out operations
 */

(function() {
    'use strict';

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
        clockInBtn.disabled = show || !currentLocation;
        clockOutBtn.disabled = show || !currentLocation;
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

        // Enable buttons if we have GPS
        if (currentLocation) {
            clockInBtn.disabled = false;
            clockOutBtn.disabled = false;
        }
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

    // GPS Functions
    function initGPS() {
        if (!navigator.geolocation) {
            gpsStatusEl.classList.remove('acquiring');
            gpsStatusTextEl.textContent = 'GPS not supported';
            showAlert('Geolocation is not supported by your browser', 'error');
            return;
        }

        // Start watching position
        const options = {
            enableHighAccuracy: true,
            timeout: 30000,
            maximumAge: 0
        };

        gpsWatchId = navigator.geolocation.watchPosition(
            handleGPSSuccess,
            handleGPSError,
            options
        );
    }

    function handleGPSSuccess(position) {
        currentLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
        };

        gpsStatusEl.classList.remove('acquiring');
        gpsStatusTextEl.textContent = 'GPS location acquired';
        gpsCoordinatesEl.textContent = `${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}`;
        gpsAccuracyEl.textContent = `±${Math.round(currentLocation.accuracy)} meters`;

        // Enable buttons
        if (!loadingEl.classList.contains('show')) {
            clockInBtn.disabled = false;
            clockOutBtn.disabled = false;
        }

        hideAlert();
    }

    function handleGPSError(error) {
        gpsStatusEl.classList.remove('acquiring');
        
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
                    device_id: deviceId
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
                    is_mocked: checkMockLocation()
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
