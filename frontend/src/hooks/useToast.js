import { useState } from 'react';

export default function useToast() {
  const [toast, setToast] = useState(null);

  const showToast = (text) => {
    setToast(text);
    setTimeout(() => setToast(null), 4000);
  };

  const clearToast = () => setToast(null);

  return { toast, showToast, clearToast };
}
