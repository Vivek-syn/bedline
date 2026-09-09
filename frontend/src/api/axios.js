// A pre-configured axios "instance". Instead of writing
// axios.get('http://localhost:5000/api/...') everywhere and
// manually attaching the auth token every single time, every
// other file just does:
//
//   import api from '../api/axios';
//   api.get('/beds');
//
// and this file handles the boring, repetitive parts.

import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
});

// An "interceptor" runs on EVERY outgoing request before it's
// sent. Here we grab the JWT we stored in localStorage after
// login, and attach it as an Authorization header — this is
// what the backend's `authenticate` middleware checks for.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
