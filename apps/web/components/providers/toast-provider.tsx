'use client';

import { Toaster } from 'react-hot-toast';

export function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: '#fff',
          color: '#202122',
          border: '1px solid #a2a9b1',
          borderRadius: '2px',
          padding: '12px 16px',
          fontSize: '14px',
        },
        success: {
          iconTheme: {
            primary: '#36c',
            secondary: '#fff',
          },
        },
        error: {
          iconTheme: {
            primary: '#d33',
            secondary: '#fff',
          },
        },
      }}
    />
  );
}
