// Check-in state
let activeRehearsal = null;
let userCheckInStatus = null;

// DOM elements
const checkInButton = document.getElementById('checkInButton');
const checkInStatus = document.getElementById('checkInStatus');
const rehearsalTime = document.getElementById('rehearsalTime');
const rehearsalLocation = document.getElementById('rehearsalLocation');
const rehearsalScenes = document.getElementById('rehearsalScenes');

/**
 * Initialize check-in functionality
 */
function initCheckIn() {
  if (checkInButton) {
    checkInButton.addEventListener('click', handleCheckIn);
  }
}

/**
 * Load current rehearsal data
 */
async function loadRehearsalData() {
  if (!currentUser) return;
  
  try {
    // Find today's rehearsal
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    
    const rehearsalsRef = db.collection('rehearsals');
    const query = rehearsalsRef
      .where('start_time', '>=', todayStart)
      .where('start_time', '<=', todayEnd)
      .orderBy('start_time', 'asc');
    
    const snapshot = await query.get();
    
    if (snapshot.empty) {
      console.log('No rehearsals scheduled for today');
      updateRehearsalInfo(null);
      return;
    }
    
    // Get the first rehearsal of the day
    const rehearsalDoc = snapshot.docs[0];
    activeRehearsal = {
      id: rehearsalDoc.id,
      ...rehearsalDoc.data()
    };
    
    console.log('Active rehearsal:', activeRehearsal);
    
    // Update the UI with rehearsal info
    updateRehearsalInfo(activeRehearsal);
    
    // Check if user is already checked in
    await checkUserCheckInStatus();
    
    // If we're a stage manager, load attendance data
    if (userRole === USER_ROLES.STAGE_MANAGER || 
        userRole === USER_ROLES.DIRECTOR || 
        userRole === USER_ROLES.ADMIN) {
      loadAttendanceData();
    }
    
  } catch (error) {
    console.error('Error loading rehearsal data:', error);
    showToast('Error loading rehearsal information');
  }
}

/**
 * Update the rehearsal information in the UI
 */
function updateRehearsalInfo(rehearsal) {
  if (!rehearsal) {
    // No rehearsal today
    if (rehearsalTime) rehearsalTime.textContent = 'No rehearsal scheduled for today';
    if (rehearsalLocation) rehearsalLocation.textContent = 'N/A';
    if (rehearsalScenes) rehearsalScenes.textContent = 'N/A';
    
    if (checkInButton) {
      disableCheckIn('No rehearsal scheduled for today');
    }
    
    if (checkInStatus) {
      checkInStatus.textContent = 'No rehearsal today';
      checkInStatus.className = 'status';
    }
    
    return;
  }
  
  // Format start and end times
  const startTime = rehearsal.start_time.toDate();
  const endTime = rehearsal.end_time.toDate();
  
  const timeFormat = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  
  const timeString = `${timeFormat.format(startTime)} - ${timeFormat.format(endTime)}`;
  
  // Update UI elements
  if (rehearsalTime) rehearsalTime.textContent = timeString;
  if (rehearsalLocation) rehearsalLocation.textContent = rehearsal.location || REHEARSAL_LOCATION.name;
  if (rehearsalScenes) rehearsalScenes.textContent = rehearsal.scenes || 'Full rehearsal';
  
  // Update production name
  const productionElements = document.querySelectorAll('#current-show, #sm-production-info');
  productionElements.forEach(el => {
    if (el) el.textContent = `Current Production: "${rehearsal.production_name}"`;
  });
  
  // Check if check-in is available based on time
  updateCheckInAvailability(startTime);
}

/**
 * Check if the user is already checked in
 */
async function checkUserCheckInStatus() {
  if (!currentUser || !activeRehearsal) return;
  
  try {
    // Check if there's an attendance record for this user and rehearsal
    const attendanceRef = db.collection('attendance')
      .where('user_id', '==', currentUser.uid)
      .where('rehearsal_id', '==', activeRehearsal.id);
    
    const snapshot = await attendanceRef.get();
    
    if (!snapshot.empty) {
      // User is already checked in
      const attendanceDoc = snapshot.docs[0];
      userCheckInStatus = {
        id: attendanceDoc.id,
        ...attendanceDoc.data()
      };
      
      // Update UI to show checked in
      updateCheckedInUI(userCheckInStatus);
    } else {
      // User is not checked in yet
      userCheckInStatus = null;
      
      if (checkInStatus) {
        checkInStatus.textContent = 'You are not checked in yet';
        checkInStatus.className = 'status pending';
      }
    }
  } catch (error) {
    console.error('Error checking user check-in status:', error);
  }
}

/**
 * Update the check-in button availability based on rehearsal time
 */
function updateCheckInAvailability(rehearsalStart) {
  const now = new Date();
  
  // Calculate time difference in minutes
  const diffMs = rehearsalStart - now;
  const diffMinutes = Math.floor(diffMs / 60000);
  
  if (diffMinutes > CHECK_IN_CONFIG.earlyCheckInWindow) {
    // Too early to check in
    disableCheckIn(`Check-in will open ${CHECK_IN_CONFIG.earlyCheckInWindow} minutes before rehearsal`);
    
    if (checkInStatus) {
      checkInStatus.textContent = `Check-in opens at ${new Date(rehearsalStart - (CHECK_IN_CONFIG.earlyCheckInWindow * 60000)).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}`;
      checkInStatus.className = 'status pending';
    }
  } else if (diffMinutes < -180) {  // Allow check-in up to 3 hours after start
    // Rehearsal started too long ago
    disableCheckIn('Check-in period has ended');
    
    if (checkInStatus) {
      checkInStatus.textContent = 'Check-in period has ended';
      checkInStatus.className = 'status error';
    }
  } else {
    // Check-in is available, enable if at location
    checkLocationForRehearsalVenue();
  }
}

/**
 * Handle the check-in button click
 */
async function handleCheckIn() {
  if (!currentUser || !activeRehearsal || checkInButton.disabled) return;
  
  try {
    // Update button and status to show processing
    checkInButton.disabled = true;
    checkInStatus.textContent = 'Processing check-in...';
    checkInStatus.className = 'status pending';
    
    // Verify location again
    const isAtVenue = checkLocationForRehearsalVenue();
    
    if (!isAtVenue) {
      showToast('You must be at the rehearsal location to check in');
      return;
    }
    
    // Create attendance record
    const now = new Date();
    const rehearsalStart = activeRehearsal.start_time.toDate();
    
    // Determine if check-in is late
    const isLate = now > new Date(rehearsalStart.getTime() + (CHECK_IN_CONFIG.lateThreshold * 60000));
    
    const attendanceData = {
      user_id: currentUser.uid,
      user_name: userProfile.displayName || currentUser.email,
      user_role: userProfile.character || 'Cast Member',
      rehearsal_id: activeRehearsal.id,
      production_id: activeRehearsal.production_id,
      check_in_time: now,
      is_late: isLate,
      status: 'present',
      notes: isLate ? 'Checked in late' : ''
    };
    
    // Save to Firestore
    const attendanceRef = await db.collection('attendance').add(attendanceData);
    
    // Update local state
    userCheckInStatus = {
      id: attendanceRef.id,
      ...attendanceData
    };
    
    // Update UI
    updateCheckedInUI(userCheckInStatus);
    
    // Notify stage manager
    sendCheckInNotification(userCheckInStatus);
    
  } catch (error) {
    console.error('Error during check-in:', error);
    
    checkInStatus.textContent = 'Error checking in. Please try again.';
    checkInStatus.className = 'status error';
    
    checkInButton.disabled = false;
    
    showToast('Error checking in. Please try again.');
  }
}

/**
 * Update UI after successful check-in
 */
function updateCheckedInUI(checkInData) {
  if (!checkInData) return;
  
  if (checkInButton) {
    checkInButton.disabled = true;
    checkInButton.textContent = 'Checked In ✓';
    checkInButton.style.backgroundColor = '#27ae60';
  }
  
  if (checkInStatus) {
    const checkInTime = checkInData.check_in_time.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
    
    if (checkInData.is_late) {
      checkInStatus.textContent = `Checked in late at ${checkInTime}`;
      checkInStatus.className = 'status warning';
    } else {
      checkInStatus.textContent = `Successfully checked in at ${checkInTime}`;
      checkInStatus.className = 'status success';
    }
  }
}

/**
 * Send notification to stage manager about check-in
 */
async function sendCheckInNotification(checkInData) {
  if (!checkInData || !activeRehearsal) return;
  
  try {
    // Find stage managers for this production
    const productionStaffRef = db.collection('production_staff')
      .where('production_id', '==', activeRehearsal.production_id)
      .where('role', 'in', ['stage_manager', 'director', 'admin']);
    
    const staffSnapshot = await productionStaffRef.get();
    
    if (staffSnapshot.empty) {
      console.log('No staff members found to notify');
      return;
    }
    
    // Create notification for each staff member
    const notifications = staffSnapshot.docs.map(doc => {
      const staffMember = doc.data();
      
      return {
        user_id: staffMember.user_id,
        title: 'Check-in Notification',
        message: `${checkInData.user_name} (${checkInData.user_role}) has checked in${checkInData.is_late ? ' late' : ''}.`,
        type: 'check_in',
        read: false,
        created_at: new Date(),
        data: {
          attendance_id: checkInData.id,
          rehearsal_id: checkInData.rehearsal_id,
          user_id: checkInData.user_id
        }
      };
    });
    
    // Batch write all notifications
    const batch = db.batch();
    
    notifications.forEach(notification => {
      const notifRef = db.collection('notifications').doc();
      batch.set(notifRef, notification);
    });
    
    await batch.commit();
    console.log(`Sent ${notifications.length} check-in notifications`);
    
  } catch (error) {
    console.error('Error sending check-in notification:', error);
  }
}

/**
 * Load attendance data for stage manager view
 */
async function loadAttendanceData() {
  if (!activeRehearsal) return;
  
  try {
    // Get all cast members for this production
    const castRef = db.collection('production_cast')
      .where('production_id', '==', activeRehearsal.production_id);
    
    const castSnapshot = await castRef.get();
    
    if (castSnapshot.empty) {
      console.log('No cast members found for this production');
      updateAttendanceUI([]);
      return;
    }
    
    // Get attendance records for this rehearsal
    const attendanceRef = db.collection('attendance')
      .where('rehearsal_id', '==', activeRehearsal.id);
    
    const attendanceSnapshot = await attendanceRef.get();
    
    // Convert to map for easy lookup
    const attendanceMap = {};
    attendanceSnapshot.forEach(doc => {
      const data = doc.data();
      attendanceMap[data.user_id] = {
        id: doc.id,
        ...data
      };
    });
    
    // Create complete attendance list
    const attendanceList = castSnapshot.docs.map(doc => {
      const castMember = doc.data();
      const attendance = attendanceMap[castMember.user_id];
      
      return {
        user_id: castMember.user_id,
        name: castMember.display_name,
        role: castMember.character,
        checked_in: !!attendance,
        late: attendance ? attendance.is_late : false,
        check_in_time: attendance ? attendance.check_in_time : null,
        status: attendance ? attendance.status : 'absent'
      };
    });
    
    // Update the UI
    updateAttendanceUI(attendanceList);
    
  } catch (error) {
    console.error('Error loading attendance data:', error);
    showToast('Error loading attendance data');
  }
}

/**
 * Update the stage manager UI with attendance data
 */
function updateAttendanceUI(attendanceList) {
  // Update count summaries
  const checkedInCount = attendanceList.filter(a => a.checked_in).length;
  const totalCount = attendanceList.length;
  
  const checkedInCountEl = document.getElementById('checkedInCount');
  if (checkedInCountEl) {
    checkedInCountEl.textContent = `${checkedInCount}/${totalCount}`;
  }
  
  const missingCountEl = document.getElementById('missingCount');
  if (missingCountEl) {
    missingCountEl.textContent = totalCount - checkedInCount;
  }
  
  // Update rehearsal start time
  const rehearsalStartEl = document.getElementById('rehearsalStart');
  if (rehearsalStartEl && activeRehearsal) {
    const startTime = activeRehearsal.start_time.toDate();
    const now = new Date();
    
    // Calculate time until/since rehearsal
    const diffMs = startTime - now;
    const diffMinutes = Math.floor(diffMs / 60000);
    
    if (diffMinutes > 0) {
      rehearsalStartEl.textContent = `${startTime.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} (${diffMinutes} minutes from now)`;
    } else if (diffMinutes > -60) {
      rehearsalStartEl.textContent = `${startTime.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} (Started ${Math.abs(diffMinutes)} minutes ago)`;
    } else {
      rehearsalStartEl.textContent = `${startTime.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} (In progress)`;
    }
  }
  
  // Update lists
  updateAttendanceList('allActorsList', attendanceList);
  updateAttendanceList('checkedInList', attendanceList.filter(a => a.checked_in));
  updateAttendanceList('missingList', attendanceList.filter(a => !a.checked_in));
}

/**
 * Update a specific attendance list in the UI
 */
function updateAttendanceList(listId, attendanceList) {
  const listEl = document.getElementById(listId);
  if (!listEl) return;
  
  // Clear current list
  listEl.innerHTML = '';
  
  if (attendanceList.length === 0) {
    const emptyItem = document.createElement('li');
    emptyItem.className = 'placeholder';
    emptyItem.textContent = 'No cast members to display';
    listEl.appendChild(emptyItem);
    return;
  }
  
  // Sort the list - checked in first, then alphabetically
  attendanceList.sort((a, b) => {
    if (a.checked_in && !b.checked_in) return -1;
    if (!a.checked_in && b.checked_in) return 1;
    return a.name.localeCompare(b.name);
  });
  
  // Add each attendance item
  attendanceList.forEach(attendance => {
    const item = document.createElement('li');
    item.className = 'actor-item';
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'actor-name';
    
    const indicator = document.createElement('span');
    
    if (attendance.checked_in) {
      indicator.className = 'status-indicator checked-in';
    } else {
      indicator.className = 'status-indicator absent';
    }
    
    nameSpan.appendChild(indicator);
    nameSpan.appendChild(document.createTextNode(`${attendance.name} (${attendance.role})`));
    
    const statusSpan = document.createElement('span');
    
    if (attendance.checked_in) {
      const timeStr = attendance.check_in_time.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
      statusSpan.textContent = `Checked in at ${timeStr}${attendance.late ? ' (late)' : ''}`;
    } else {
      statusSpan.textContent = 'Not checked in';
    }
    
    item.appendChild(nameSpan);
    item.appendChild(statusSpan);
    listEl.appendChild(item);
  });
}
