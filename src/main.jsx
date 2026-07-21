import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';
import '@/styles/headless-polish.css';
import { initializeSupabaseData } from '@/utils/initializeData';

// The initializeSupabaseData function currently contains placeholder data or setup that is not directly related to user data.
// It's important to ensure this function is correctly implemented for your application's specific needs,
// or removed if not required, to prevent unexpected behavior.
// For now, it is called here to ensure any initial setup it performs is executed.
initializeSupabaseData();

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
);
