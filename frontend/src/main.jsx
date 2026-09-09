// This is the FIRST piece of JavaScript that runs. Its only job:
// find the <div id="root"> from index.html and render the <App />
// component into it.

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* BrowserRouter enables page navigation (like /login, /dashboard)
        without ever actually reloading the browser page. */}
    <BrowserRouter>
      {/* AuthProvider wraps the WHOLE app so that any component,
          anywhere, can ask "who is logged in?" without us having
          to manually pass that info down through every component. */}
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
