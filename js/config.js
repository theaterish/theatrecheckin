// Main app initialization
document.addEventListener('DOMContentLoaded', function() {
  // Initialize Firebase auth
  initAuth();
  
  // Initialize location services
  initLocationServices();
  
  // Initialize check-in functionality
  initCheckIn();
  
  // Set up tab switching for stage manager view
  initTabSystem();
  
  // Set up navigation
  initNavigation();
  
  // Handle notification permissions
  requestNotificationPermission();
  
  console.log('Theatre Check-In App initialized');
});

/**
 * Initialize the tab system for the stage manager view
 */
function initTabSystem() {
  const tabs = document.querySelectorAll('.tab');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active class from all tabs
      tabs.forEach(t => t.classList.remove('active'));
      
      // Add active class to clicked tab
      tab.classList.add('active');
      
      // Hide all tab contents
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      
      // Show the selected tab content
      const tabId = tab.getAttribute('data-tab');
      const tabContent = document.getElementById(tabId);
      
      if (tabContent) {
        tabContent.classList.add('active');
      }
    });
  });
}

/**
 * Initialize navigation between app sections
 */
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const viewName = item.getAttribute('data-view');
      
      if (viewName === 'home') {
        // Special case for home - show appropriate view based on role
        showAppropriateView();
      } else if (viewName === 'profile') {
        // Handle sign out if this is the profile tab
        if (confirm('Would you like to sign out?')) {
          signOut();
        }
      } else {
        // For other views, show a "coming soon" message
        showToast(`${viewName.charAt(0).toUpperCase() + viewName.slice(1)} view coming soon!`);
      }
      
      // Update active nav item
      navItems.forEach(navItem => {
        navItem.classList.remove('active');
      });
      
      item.classList.add('active');
    });
  });
}

/**
 * Request permission for push notifications
 */
function requestNotificationPermission() {
  if ('Notification' in window) {
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission().then(function(permission) {
        if (permission === 'granted') {
          console.log('Notification permission granted');
          setupFirebaseMessaging();
        }
      });
    } else if (Notification.permission === 'granted') {
      console.log('Notification permission already granted');
      setupFirebaseMessaging();
    }
  }
}

/**
 * Set up Firebase Cloud Messaging for push notifications
 */
function setupFirebaseMessaging() {
  if (!firebase.messaging.isSupported()) {
    console.log('Firebase messaging is not supported in this browser');
    return;
  }
  
  const messaging = firebase.messaging();
  
  // Get registration token
  messaging.getToken({ vapidKey: 'YOUR_PUBLIC_VAPID_KEY' })
    .then((currentToken) => {
      if (currentToken) {
        // Send the token to your server
        updateUserMessagingToken(currentToken);
      } else {
        console.log('No registration token available');
      }
    })
    .catch((err) => {
      console.log('An error occurred while retrieving token:', err);
    });
  
  // Handle token refresh
  messaging.onTokenRefresh(() => {
    messaging.getToken({ vapidKey: 'YOUR_PUBLIC_VAPID_KEY' })
      .then((refreshedToken) => {
        updateUserMessagingToken(refreshedToken);
      })
      .catch((err) => {
        console.log('Unable to retrieve refreshed token:', err);
      });
  });
  
  // Handle incoming messages
  messaging.onMessage((payload) => {
    console.log('Message received:', payload);
    
    // Show notification
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
      body: payload.notification.body,
      icon: '/images/icon-192x192.png'
    };
    
    new Notification(notificationTitle, notificationOptions);
  });
}

/**
 * Update the user's messaging token in Firestore
 */
async function updateUserMessagingToken(token) {
  if (!currentUser) return;
  
  try {
    await db.collection('users').doc(currentUser.uid).update({
      messaging_tokens: firebase.firestore.FieldValue.arrayUnion(token),
      token_updated_at: new Date()
    });
    
    console.log('Messaging token updated successfully');
  } catch (error) {
    console.error('Error updating messaging token:', error);
  }
}

/**
 * Register the service worker for PWA support
 */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/service-worker.js')
      .then(function(registration) {
        console.log('ServiceWorker registration successful with scope:', registration.scope);
      })
      .catch(function(err) {
        console.log('ServiceWorker registration failed:', err);
      });
  });
}
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCDF9_1SAsjkBWnMXvmCJqMuvZpSUyRa3o",
  authDomain: "theatre-check-in-app.firebaseapp.com",
  projectId: "theatre-check-in-app",
  storageBucket: "theatre-check-in-app.firebasestorage.app",
  messagingSenderId: "927794666232",
  appId: "1:927794666232:web:7c19a30c3d6fed6d62f90d",
  measurementId: "G-194L57FXCH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
