// Firebase configuration
const firebaseConfig = {
  // TODO: Replace with your Firebase project configuration
  // You'll get these values when you create a Firebase project
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Shortcuts for Firebase services
const auth = firebase.auth();
const db = firebase.firestore();
const messaging = firebase.messaging();

// Rehearsal venue coordinates (to be updated with your actual venue)
const REHEARSAL_LOCATION = {
  latitude: 40.7128, // Example: NYC coordinates
  longitude: -74.0060,
  radius: 100, // in meters, how close someone needs to be to check in
  name: "Main Theatre"
};

// Configuration for check-in settings
const CHECK_IN_CONFIG = {
  // How many minutes before rehearsal start time can people check in
  earlyCheckInWindow: 60,
  // How many minutes after rehearsal start time is considered "late"
  lateThreshold: 15,
  // How many minutes before rehearsal to send reminders to those not checked in
  reminderBeforeStart: 30
};

// User roles
const USER_ROLES = {
  ACTOR: 'actor',
  STAGE_MANAGER: 'stage_manager',
  DIRECTOR: 'director',
  ADMIN: 'admin'
};

// App version
const APP_VERSION = '1.0.0';
