import { useAppStore } from './useAppStore';

export const useToast = () => {
  const addToast = useAppStore((state) => state.addToast);
  const removeToast = useAppStore((state) => state.removeToast);
  const toasts = useAppStore((state) => state.toasts);

  const success = (message: string) => addToast(message, 'success');
  const error = (message: string) => addToast(message, 'error');
  const info = (message: string) => addToast(message, 'info');
  const warning = (message: string) => addToast(message, 'warning');

  return {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    info,
    warning,
  };
};
